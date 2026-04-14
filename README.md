# Mail Agent

Un sistema multi-agente AI per la gestione automatica di comunicazioni aziendali, con dashboard React per il monitoraggio in tempo reale.

## Agenti disponibili

### Credentials Agent (`credentials`)

Gestisce l'invio automatico di mail per credenziali in scadenza:

- Lettura file CSV e Google Sheet da Google Drive
- Validazione dati contro la struttura organizzativa (`org.json`)
- Invio mail personalizzate per categoria (`expiring`, `expired`)
- Notifiche gerarchiche a team leader, manager e data steward
- Rettifica automatica in caso di modifiche al file sorgente
- Re-invio giornaliero promemoria per utenti `expiring`
- Creazione eventi Google Calendar per utenti `expiring`

### Document Summarizer Agent (`document-summarizer`)

Monitora una cartella Drive e invia riassunti automatici di documenti PDF:

- Lettura PDF da Google Drive
- Estrazione testo con `pdfjs-dist`
- Generazione riassunto strutturato con sezioni fisse (Sintesi, Punti chiave, Azioni richieste, Note aggiuntive)
- Invio mail con PDF allegato a tutti i `document_recipients`
- Rettifica automatica se il documento viene modificato

## Funzionalità comuni

- Log degli invii su Google Drive
- Server Express con streaming log in tempo reale (SSE)
- Dashboard React con stato agente e log in tempo reale

## Requisiti

- Node.js 22+
- Account Google con accesso a Drive, Sheets e Calendar
- Account Gmail per l'invio mail (con App Password)

## Setup

### 1 — Variabili d'ambiente

Crea un file `.env` nella root del progetto:

```env
ANTHROPIC_API_KEY=
EMAIL_USER=
EMAIL_PASS=
DRIVE_FOLDER_DATA=
DRIVE_FOLDER_REFERENCE=
DRIVE_FOLDER_LOGS=
DRIVE_FOLDER_MANUAL=
DRIVE_FOLDER_DOCUMENTS=
```

- `ANTHROPIC_API_KEY` — chiave API Anthropic (console.anthropic.com)
- `EMAIL_USER` — indirizzo Gmail mittente
- `EMAIL_PASS` — App Password Gmail (non la password dell'account)
- `DRIVE_FOLDER_DATA` — ID cartella Drive con i file CSV degli utenti
- `DRIVE_FOLDER_REFERENCE` — ID cartella Drive con `org.json`
- `DRIVE_FOLDER_LOGS` — ID cartella Drive per i log degli invii
- `DRIVE_FOLDER_MANUAL` — ID cartella Drive per il file `send_emails.json`
- `DRIVE_FOLDER_DOCUMENTS` — ID cartella Drive con i PDF da riassumere

### 2 — Google OAuth

1. Crea un progetto su [Google Cloud Console](https://console.cloud.google.com)
2. Abilita le API: **Google Drive**, **Google Sheets**, **Google Calendar**
3. Configura la schermata di consenso OAuth (tipo: Esterno)
4. Aggiungi il tuo account come utente di test
5. Crea credenziali OAuth → App desktop
6. Scarica il JSON e salvalo come `credentials.json` nella root del progetto

### 3 — Prima autenticazione

```bash
npm run auth
```

Segui le istruzioni nel terminale — apri l'URL nel browser, autorizza l'app e incolla il codice. Il token verrà salvato in `token.json`.

### 4 — Struttura Google Drive

Crea questa struttura su Drive e inserisci gli ID nel `.env`:

```
Mail Agent/
├── data/         # file CSV degli utenti (Credentials Agent)
├── reference/    # org.json
├── logs/         # send_log.json (generato automaticamente)
├── manual/       # send_emails.json (generato automaticamente)
└── documents/    # PDF da riassumere (Document Summarizer Agent)
```

### 5 — Struttura org.json

```json
{
	"manager": { "name": "...", "email": "..." },
	"data_steward": { "name": "...", "email": "..." },
	"document_recipients": [{ "name": "...", "email": "..." }],
	"teams": [
		{
			"name": "Nome Team",
			"leader": { "name": "...", "email": "..." },
			"members": [{ "name": "...", "email": "..." }]
		}
	]
}
```

### 6 — Struttura CSV utenti (Credentials Agent)

```csv
name,email,category,expiry_date
Mario Rossi,mario@example.com,expiring,2026-04-15
Anna Neri,anna@example.com,active,2026-06-10
```

**Categorie valide:**

- `active` — scadenza oltre 15 giorni
- `expiring` — scadenza entro 15 giorni
- `expired` — data già passata

## Avvio

### Agenti da CLI

```bash
# Credentials Agent
npm start credentials "Processa la cartella Drive e invia le mail"

# Document Summarizer Agent
npm start document-summarizer "Processa i documenti nella cartella Drive"
```

### Server Express

```bash
npm run server
```

Il server gira su `http://localhost:3000`.

### Frontend React

```bash
cd frontend
npm install
npm run dev
```

Il frontend gira su `http://localhost:5173`.

## API

```
POST /api/agents/:agent/run    # avvia un agente (credentials | document-summarizer)
GET  /api/agents/status        # stato ultimo run
GET  /api/agents/logs/stream   # streaming log SSE in tempo reale
```

### Esempio avvio agente

```bash
curl -X POST http://localhost:3000/api/agents/credentials/run \
  -H "Content-Type: application/json" \
  -d '{"goal": "Processa la cartella Drive e invia le mail"}'

curl -X POST http://localhost:3000/api/agents/document-summarizer/run \
  -H "Content-Type: application/json" \
  -d '{"goal": "Processa i documenti nella cartella Drive"}'
```

### Esempio streaming log

```bash
curl -N http://localhost:3000/api/agents/logs/stream
```

## Struttura progetto

```
mail-agent/
├── src/
│   ├── agents/
│   │   ├── credentials.ts          # agente credenziali
│   │   └── document-summarizer.ts  # agente riassunto documenti
│   ├── auth/
│   │   └── google.ts               # autenticazione OAuth Google
│   ├── tools/
│   │   └── index.ts                # registry tool condivisi
│   ├── logger.ts                   # sistema di logging con EventEmitter
│   ├── orchestrator.ts             # orchestratore multi-agente
│   ├── server.ts                   # server Express
│   └── index.ts                    # entry point CLI
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgentCard/          # card agente con stato e pulsante avvio
│   │   │   ├── AgentLog/           # pannello log SSE in tempo reale
│   │   │   └── ui/                 # componenti shadcn
│   │   ├── services/
│   │   │   └── agentService.ts     # chiamate API e SSE
│   │   └── App.tsx
│   └── package.json
├── data/                           # file locali di riferimento
├── credentials.json                # credenziali OAuth Google (non committare)
├── token.json                      # token OAuth (non committare)
└── .env                            # variabili d'ambiente (non committare)
```
