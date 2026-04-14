import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, toolImplementations } from "../tools/index.js";
import { logStep } from "../logger.js";

const client = new Anthropic();

const SYSTEM_PROMPT = `Sei un agente che gestisce il riassunto e l'invio di documenti PDF.
La data odierna è: ${new Date().toISOString().split("T")[0]}.

Hai accesso ai seguenti tool:
- list_drive_folder: usa sempre come primo passo per scoprire i PDF disponibili, passando folderEnvKey: "DRIVE_FOLDER_DOCUMENTS"
- read_drive_pdf: scarica e estrae il testo da un PDF, usare solo per file con mimeType "application/pdf"
- read_org: leggi la struttura organizzativa per ottenere i document_recipients
- summarize_document: genera il riassunto strutturato del testo estratto
- check_send_log: controlla sempre prima di processare un file, passando filename e lastModifiedAt ottenuti da list_drive_folder
- send_email: invia il riassunto via mail con il PDF come allegato
- write_send_log: scrivi sempre dopo aver completato tutti gli invii

CASO 1 — stato "never_sent":
1. read_drive_pdf per estrarre il testo
2. read_org per ottenere i document_recipients
3. summarize_document con il testo estratto
4. send_email a ogni document_recipient con:
   - subject: "Riassunto documento: [filename]"
   - body: il riassunto generato da summarize_document
   - attachmentCacheKey: la chiave ottenuta da read_drive_pdf
   - isRectification: false
5. write_send_log con status: "sent"

CASO 2 — stato "modified_after_send":
1. read_drive_pdf per estrarre il testo aggiornato
2. read_org per ottenere i document_recipients
3. summarize_document con il testo aggiornato
4. send_email a ogni document_recipient con:
   - subject: "Aggiornamento documento: [filename]"
   - body: il riassunto aggiornato
   - attachment: { filename, content: base64 del PDF }
   - isRectification: true
   - previousSentAt: data dell'ultimo invio dal log
5. write_send_log con status: "rectification_sent"

CASO 3 — stato "already_sent":
- Nessuna azione, il documento è già stato processato e non è stato modificato

Quando ti viene dato un obiettivo, segui sempre questo flusso nell'ordine indicato:
1. list_drive_folder con folderEnvKey: "DRIVE_FOLDER_DOCUMENTS"
2. check_send_log per ogni file trovato
3. Segui il CASO corrispondente allo stato ricevuto`;

export async function runAgent(userGoal: string): Promise<void> {
    logStep(`🎯 Obiettivo: ${userGoal}`);

    const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userGoal },
    ];

    // Loop agente
    while (true) {
        const response = await client.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            tools: toolDefinitions,
            messages,
        });

        logStep(`[agente] stop_reason: ${response.stop_reason}`);

        // Aggiungi la risposta del modello alla storia
        messages.push({ role: "assistant", content: response.content });

        // Se il modello ha finito, stampa la risposta finale ed esci
        if (response.stop_reason === "end_turn") {
            const textBlock = response.content.find((b) => b.type === "text");
            if (textBlock && textBlock.type === "text") {
                logStep(`\n✅ Risposta finale:\n${textBlock.text}`);
            }
            break;
        }

        // Se il modello vuole usare un tool
        if (response.stop_reason === "tool_use") {
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of response.content) {
                if (block.type !== "tool_use") continue;

                logStep(`[agente] chiama tool: ${block.name}`);
                logStep(`[agente] input: ${JSON.stringify(block.input)}`);

                const implementation = toolImplementations[block.name];

                if (!implementation) {
                    throw new Error(`Tool non trovato: ${block.name}`);
                }

                const result = await implementation(block.input as Record<string, unknown>);
                logStep(`[agente] risultato: ${JSON.stringify(result)}\n`);

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