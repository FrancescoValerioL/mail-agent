# Mail Agent

Un agente AI che gestisce l'invio automatico di mail a utenti in base al contenuto di file CSV/Google Sheet su Google Drive.

## Funzionalità

- Lettura file CSV e Google Sheet da Google Drive
- Validazione dei dati contro la struttura organizzativa (`org.json`)
- Invio mail personalizzate per categoria (`expiring`, `expired`)
- Notifiche gerarchiche a team leader, manager e data steward
- Rettifica automatica in caso di modifiche al file sorgente
- Re-invio giornaliero promemoria per utenti `expiring`
- Creazione eventi Google Calendar per utenti `expiring`
- Log degli invii su Google Drive
- Server Express con streaming log in tempo reale (SSE)

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
```

- `ANTHROPIC_API_KEY` — chiave API Anthropic (console.anthropic.com)
- `EMAIL_USER` — indirizzo Gmail mittente
- `EMAIL_PASS` — App Password Gmail (non la password dell'account)
- `DRIVE_FOLDER_DATA` — ID cartella Drive con i file CSV degli utenti
- `DRIVE_FOLDER_REFERENCE` — ID cartella Drive con `org.json`
- `DRIVE_FOLDER_LOGS` — ID cartella Drive per i log degli invii
- `DRIVE_FOLDER_MANUAL` — ID cartella Drive per il file `send_emails.json`

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
├── data/         # file CSV degli utenti
├── reference/    # org.json
├── logs/         # send_log.json (generato automaticamente)
└── manual/       # send_emails.json (generato automaticamente)
```

### 5 — Struttura org.json

```json
{
	"manager": { "name": "...", "email": "..." },
	"data_steward": { "name": "...", "email": "..." },
	"teams": [
		{
			"name": "Nome Team",
			"leader": { "name": "...", "email": "..." },
			"members": [{ "name": "...", "email": "..." }]
		}
	]
}
```

### 6 — Struttura CSV utenti

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

### Agente da CLI

```bash
npm start credentials "Processa la cartella Drive e invia le mail"
```

### Server Express

```bash
npm run server
```

Il server gira su `http://localhost:3000`.

## API

```
POST /api/agents/:agent/run    # avvia un agente
GET  /api/agents/status        # stato ultimo run
GET  /api/agents/logs/stream   # streaming log SSE in tempo reale
```

### Esempio avvio agente

```bash
curl -X POST http://localhost:3000/api/agents/credentials/run \
  -H "Content-Type: application/json" \
  -d '{"goal": "Processa la cartella Drive e invia le mail"}'
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
│   │   └── credentials.ts    # agente credenziali
│   ├── auth/
│   │   └── google.ts         # autenticazione OAuth Google
│   ├── tools/
│   │   └── index.ts          # registry tool
│   ├── logger.ts             # sistema di logging con EventEmitter
│   ├── orchestrator.ts       # orchestratore multi-agente
│   ├── server.ts             # server Express
│   └── index.ts              # entry point CLI
├── data/                     # file locali di riferimento
├── credentials.json          # credenziali OAuth Google (non committare)
├── token.json                # token OAuth (non committare)
└── .env                      # variabili d'ambiente (non committare)
```
