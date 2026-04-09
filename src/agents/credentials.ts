import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, toolImplementations } from "../tools/index.js";

const client = new Anthropic();

const SYSTEM_PROMPT = `Sei un agente che gestisce l'invio di mail a utenti.
La data odierna è: ${new Date().toISOString().split("T")[0]}.

Hai accesso ai seguenti tool:
- list_folder: usa sempre come primo passo per scoprire i file CSV disponibili
- read_csv: leggi il contenuto di un file CSV
- read_org: leggi la struttura organizzativa aziendale
- check_send_log: controlla sempre prima di inviare mail, passando filename e lastModifiedAt ottenuti da list_folder
- send_email: invia una mail a un destinatario
- write_send_log: scrivi sempre dopo aver completato tutti gli invii

Regole di validazione categoria in base a expiry_date:
- active: scadenza oltre 15 giorni → nessuna mail
- expiring: scadenza entro 15 giorni → mail personale
- expired: data già passata → mail personale urgente
- expiry_date mancante → anomalia
Se la categoria nel CSV non corrisponde a queste regole → anomalia.

Gestione anomalie:
- Raccogli tutte le anomalie (categoria errata, email malformata, persona non in org.json, expiry_date mancante)
- Non inviare mail agli utenti con anomalie
- Se ci sono anomalie, invia UNA sola mail riepilogativa al data_steward alla fine

CASO 1 — stato "never_sent":
1. read_csv e read_org
2. Valida ogni record
3. Invia mail seguendo questa gerarchia:
   - Membri expiring/expired: mail personale
   - Team leader: mail con SOLO i nomi dei membri che hanno ricevuto una mail (nessuna categoria, nessuna scadenza), solo se almeno un suo membro ha ricevuto una mail
   - Manager: mail con SOLO i nomi dei team che hanno avuto comunicazioni (nessun nome di membro), solo se almeno un team ha avuto comunicazioni
   - Data steward: riepilogo anomalie, solo se ce ne sono
4. write_send_log con status: "sent"

CASO 2 — stato "modified_after_send":
1. read_csv e read_org
2. Confronta contentSnapshot con i dati attuali — identifica solo i record cambiati
3. Invia rettifiche SOLO agli utenti i cui dati sono cambiati, con isRectification: true
4. Le mail a team leader, manager e data steward hanno sempre isRectification: false
5. Stessa gerarchia del CASO 1 ma solo per i team con almeno un membro con dati cambiati
6. write_send_log con status: "rectification_sent"

CASO 3 — stato "already_sent":
1. Leggi il contentSnapshot e lastProcessedAt restituiti da check_send_log
2. Se lastProcessedAt è uguale alla data odierna → nessuna azione, termina
3. Filtra SOLO gli utenti con categoria "expiring"
4. Se non ci sono utenti expiring → nessuna azione, termina
5. Invia mail ESCLUSIVAMENTE a quegli utenti con isRectification: false e tono di promemoria
6. NON inviare mail a team leader, manager o data steward
7. write_send_log con status: "resent"

Quando ti viene dato un obiettivo, segui sempre questo flusso nell'ordine indicato:
1. list_folder
2. check_send_log per ogni file
3. Segui il CASO corrispondente allo stato ricevuto`;

export async function runAgent(userGoal: string): Promise<void> {
    console.log(`\n🎯 Obiettivo: ${userGoal}\n`);

    const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userGoal },
    ];

    // Loop agente
    while (true) {
        const response = await client.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: toolDefinitions,
            messages,
        });

        console.log(`[agente] stop_reason: ${response.stop_reason}`);

        // Aggiungi la risposta del modello alla storia
        messages.push({ role: "assistant", content: response.content });

        // Se il modello ha finito, stampa la risposta finale ed esci
        if (response.stop_reason === "end_turn") {
            const textBlock = response.content.find((b) => b.type === "text");
            if (textBlock && textBlock.type === "text") {
                console.log(`\n✅ Risposta finale:\n${textBlock.text}`);
            }
            break;
        }

        // Se il modello vuole usare un tool
        if (response.stop_reason === "tool_use") {
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of response.content) {
                if (block.type !== "tool_use") continue;

                console.log(`[agente] chiama tool: ${block.name}`);
                console.log(`[agente] input: ${JSON.stringify(block.input)}`);

                const implementation = toolImplementations[block.name];

                if (!implementation) {
                    throw new Error(`Tool non trovato: ${block.name}`);
                }

                const result = await implementation(block.input as Record<string, unknown>);
                console.log(`[agente] risultato: ${JSON.stringify(result)}\n`);

                toolResults.push({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: JSON.stringify(result),
                });
            }

            // Reinserisci i risultati nella storia e continua il loop
            messages.push({ role: "user", content: toolResults });
        }
    }
}