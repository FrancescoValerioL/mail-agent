import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import { getAuthClient } from "../auth/google";

export type ToolFunction = (input: Record<string, unknown>) => unknown | Promise<unknown>;

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const toolDefinitions: Anthropic.Tool[] = [
    {
        name: "read_csv",
        description:
            "Legge il file CSV degli utenti e restituisce la lista come array di oggetti",
        input_schema: {
            type: "object" as const,
            properties: {
                filename: {
                    type: "string",
                    description: "Nome del file CSV da leggere dalla cartella data/",
                },
            },
            required: ["filename"],
        },
    },
    {
        name: "check_send_log",
        description:
            "Prima di inviare email controlla il log delle mail inviate per controllare se ci sono state modifiche dall'ultima lettura del CSV, restituisce never_sent se non è mai stata inviata, already_sent se è già stata inviata, modified_after_send se è stata modificata dopo essere stata inviata",
        input_schema: {
            type: "object" as const,
            properties: {
                filename: {
                    type: "string",
                    description: "Nome del file di log da leggere dalla cartella data/",
                },
                fileModifiedAt: {
                    type: "string",
                    description:
                        "Data di ultima modifica del file CSV, per confrontarla con quella del log",
                }
            },
            required: ["filename", "fileModifiedAt"],
        }
    },
    {
        name: "list_folder",
        description: "Restituisce la lista dei file csv disponibili nella cartella e la loro data di ultima modifica",
        input_schema: {
            type: "object" as const,
            properties: {
                folderName: {
                    type: "string",
                    description: "Nome della cartella da leggere (es: data/)",
                }
            },
            required: ["folderName"],
        }
    },
    {
        name: "read_org",
        description: "Legge il file org.json e restituisce le informazioni sull'organizzazione",
        input_schema: {
            type: "object" as const,
            properties: {
                filename: {
                    type: "string",
                    description: "Nome del file org.json da leggere dalla cartella reference in google drive",
                }
            },
            required: [],
        }
    },
    {
        name: "send_email",
        description: "Invia la mail all'utente specificato. Imposta isRectification a true e previousSentAt solo quando stai inviando una correzione di una mail già inviata in precedenza.",
        input_schema: {
            type: "object" as const,
            properties: {
                to: {
                    type: "string",
                    description: "Indirizzo email del destinatario"
                },
                subject: {
                    type: "string",
                    description: "Oggetto della mail"
                },
                body: {
                    type: "string",
                    description: "Corpo della mail"
                },
                isRectification: {
                    type: "boolean",
                    description: "Indica se la mail è una rettifica (true) o una comunicazione standard (false)"
                },
                previousSentAt: {
                    type: "string",
                    description: "data precedente invio, opzionale (solo se isRectification è true)"
                }
            },
            required: ["to", "subject", "body", "isRectification"],
        }
    },
    {
        name: "write_send_log",
        description: "Scrive nel log delle mail inviate la data di invio e uno snapshot del contenuto inviato, per poter fare i confronti con le future modifiche del CSV",
        input_schema: {
            type: "object" as const,
            properties: {
                filename: {
                    type: "string",
                    description: "Nome del file di log da scrivere nella cartella data/",
                },
                fileModifiedAt: {
                    type: "string",
                    description:
                        "Data di ultima modifica del file CSV, da confrontare con i futuri check",
                },
                lastProcessedAt: {
                    type: "string",
                    description:
                        "Data di invio della mail, da scrivere nel log",
                },
                recipients: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                    description:
                        "Lista degli indirizzi email dei destinatari, da scrivere nel log",
                },
                status: {
                    type: "string",
                    description: "Stato dell'invio: 'sent' per primo invio, 'rectification_sent' per rettifica dopo modifica file, 'resent' per re-invio giornaliero a utenti expiring"
                },
                contentSnapshot: {
                    type: "array",
                    items: { type: "object" },
                    description: "Snapshot del contenuto inviato, da confrontare con i futuri check"
                }
            },
            required: ["filename", "fileModifiedAt", "contentSnapshot", "lastProcessedAt", "recipients", "status"],
        }
    },
    {
        name: "list_drive_folder",
        description: "Lista i file CSV e Google Sheet disponibili in una cartella Google Drive con la loro data di ultima modifica. Usa questo tool al posto di list_folder quando i file sono su Drive.",
        input_schema: {
            type: "object" as const,
            properties: {
                folderEnvKey: {
                    type: "string",
                    description: "Nome della variabile d'ambiente che contiene l'ID della cartella Drive. Es: DRIVE_FOLDER_DATA, DRIVE_FOLDER_REFERENCE",
                }
            },
            required: ["folderEnvKey"],
        }
    },
    {
        name: "read_drive_sheet",
        description: "Legge il contenuto di un file Google Sheet o CSV da Google Drive e lo restituisce come array di oggetti. Usa il fileId ottenuto da list_drive_folder.",
        input_schema: {
            type: "object" as const,
            properties: {
                fileId: {
                    type: "string",
                    description: "ID del file su Google Drive, ottenuto da list_drive_folder",
                },
                mimeType: {
                    type: "string",
                    description: "MIME type del file, ottenuto da list_drive_folder",
                }
            },
            required: ["fileId", "mimeType"],
        }
    },
    {
        name: "create_calendar_event",
        description: "Crea un evento sul Google Calendar dell'utente per ricordargli la scadenza delle credenziali. Usare solo per utenti con categoria 'expiring', mai per 'expired'.",
        input_schema: {
            type: "object" as const,
            properties: {
                attendeeEmail: {
                    type: "string",
                    description: "Email del destinatario dell'evento",
                },
                attendeeName: {
                    type: "string",
                    description: "Nome del destinatario",
                },
                expiryDate: {
                    type: "string",
                    description: "Data di scadenza nel formato YYYY-MM-DD",
                }
            },
            required: ["attendeeEmail", "attendeeName", "expiryDate"],
        }
    }
];

export const toolImplementations: Record<string, ToolFunction> = {
    read_csv: (input) => {
        const filename = input.filename as string;
        const filepath = path.join(process.cwd(), "data", filename);

        console.log(`[tool] read_csv legge: ${filepath}`);

        if (!fs.existsSync(filepath)) {
            return { error: `File non trovato: ${filename}` };
        }

        const content = fs.readFileSync(filepath, "utf-8");
        const result = Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
        });

        if (result.errors.length > 0) {
            return { error: `Errore parsing CSV: ${result.errors[0].message}` };
        }

        return result.data;
    },
    check_send_log: async (input) => {
        const filename = input.filename as string;
        const fileModifiedAt = new Date(input.fileModifiedAt as string);
        const folderId = process.env.DRIVE_FOLDER_LOGS;
        const logFilename = "send_log.json";

        const auth = await getAuthClient();
        const drive = google.drive({ version: "v3", auth });

        // Cerca il file di log su Drive
        const existing = await drive.files.list({
            q: `'${folderId}' in parents and name = '${logFilename}' and trashed = false`,
            fields: "files(id)",
        });

        const existingFile = existing.data.files?.[0];

        if (!existingFile?.id) {
            return { status: "never_sent" };
        }

        // Leggi il contenuto
        const response = await drive.files.get(
            { fileId: existingFile.id, alt: "media" },
            { responseType: "text" }
        );

        const logContent = JSON.parse(response.data as string);
        const logEntry = logContent[filename];

        if (!logEntry) {
            return { status: "never_sent" };
        }

        const lastLog = new Date(logEntry.fileModifiedAt);
        const fileModDate = new Date(fileModifiedAt.toISOString().split("T")[0]);
        const lastLogDate = new Date(lastLog.toISOString().split("T")[0]);

        console.log(`[tool] check_send_log lastLog: ${lastLogDate.toISOString()}`);
        console.log(`[tool] check_send_log fileModifiedAt: ${fileModDate.toISOString()}`);

        if (fileModDate > lastLogDate) {
            return {
                status: "modified_after_send",
                lastProcessedAt: logEntry.lastProcessedAt,
                contentSnapshot: logEntry.contentSnapshot,
            };
        } else {
            return {
                status: "already_sent",
                contentSnapshot: logEntry.contentSnapshot,
                lastProcessedAt: logEntry.lastProcessedAt,
            };
        }
    },
    list_folder: (input) => {
        const folderName = input.folderName as string;
        const folderPath = path.join(process.cwd(), folderName);

        console.log(`[tool] list_folder legge: ${folderPath}`);

        const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".csv"));
        const results = files.map((file) => {
            const filePath = path.join(folderPath, file);
            const stats = fs.statSync(filePath);
            return {
                filename: file,
                lastModifiedAt: stats.mtime.toISOString(),
            };
        });

        return results;
    },
    read_org: async (input) => {
        const folderId = process.env.DRIVE_FOLDER_REFERENCE;
        const filename = input.filename as string || "org.json";

        console.log(`[tool] read_org legge: ${filename} da cartella reference su Drive`);
        const auth = await getAuthClient();
        const drive = google.drive({ version: "v3", auth });
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: "files(id, name, modifiedTime, mimeType)",
            orderBy: "modifiedTime desc",
        });

        const files = response.data.files ?? [];
        const file = files.find((f) => f.name === filename);
        if (!file) {
            return { error: `File non trovato: ${filename}` };
        }
        const fileId = file.id;

        const drivefile = await drive.files.get(
            { fileId: fileId!, alt: "media" },
            { responseType: "text" }
        );
        const result = JSON.parse(drivefile.data as string);
        return result;
    },
    send_email: async (input) => {
        const to = input.to as string;
        const subject = input.subject as string;
        const body = input.body as string;
        const isRectification = input.isRectification as boolean;
        const previousSentAt = input.previousSentAt as string | undefined;

        const folderId = process.env.DRIVE_FOLDER_MANUAL;
        const logFilename = "send_emails.json";

        // Invia la mail
        await transporter.sendMail({
            from: `"Mail Agent" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text: body,
        });

        const auth = await getAuthClient();
        const drive = google.drive({ version: "v3", auth });

        // Cerca il file esistente su Drive
        const existing = await drive.files.list({
            q: `'${folderId}' in parents and name = '${logFilename}' and trashed = false`,
            fields: "files(id)",
        });

        const existingFile = existing.data.files?.[0];
        let emails: object[] = [];

        if (existingFile?.id) {
            const response = await drive.files.get(
                { fileId: existingFile.id, alt: "media" },
                { responseType: "text" }
            );
            emails = JSON.parse(response.data as string);
        }

        emails.push({
            to,
            subject,
            body,
            isRectification,
            ...(previousSentAt && { previousSentAt }),
            sentAt: new Date().toISOString(),
        });

        const fileBody = JSON.stringify(emails, null, 2);

        if (existingFile?.id) {
            await drive.files.update({
                fileId: existingFile.id,
                media: {
                    mimeType: "application/json",
                    body: fileBody,
                },
            });
        } else {
            await drive.files.create({
                requestBody: {
                    name: logFilename,
                    parents: [folderId!],
                },
                media: {
                    mimeType: "application/json",
                    body: fileBody,
                },
            });
        }

        return {
            success: true,
            to,
            isRectification,
        };
    },
    write_send_log: async (input) => {
        const filename = input.filename as string;
        const fileModifiedAt = input.fileModifiedAt as string;
        const lastProcessedAt = input.lastProcessedAt as string;
        const recipients = input.recipients as string[];
        const status = input.status as string;
        const contentSnapshot = input.contentSnapshot as object[];

        const folderId = process.env.DRIVE_FOLDER_LOGS;
        const logFilename = "send_log.json";

        const auth = await getAuthClient();
        const drive = google.drive({ version: "v3", auth });

        // Leggi il log esistente o parti da oggetto vuoto
        let logContent: Record<string, unknown> = {};

        const existing = await drive.files.list({
            q: `'${folderId}' in parents and name = '${logFilename}' and trashed = false`,
            fields: "files(id)",
        });

        const existingFile = existing.data.files?.[0];

        if (existingFile?.id) {
            const response = await drive.files.get(
                { fileId: existingFile.id, alt: "media" },
                { responseType: "text" }
            );
            logContent = JSON.parse(response.data as string);
        }

        // Aggiorna l'entry
        logContent[filename] = {
            fileModifiedAt,
            lastProcessedAt,
            recipients,
            status,
            contentSnapshot,
        };

        const body = JSON.stringify(logContent, null, 2);

        if (existingFile?.id) {
            // Aggiorna file esistente
            await drive.files.update({
                fileId: existingFile.id,
                media: {
                    mimeType: "application/json",
                    body,
                },
            });
        } else {
            // Crea nuovo file
            await drive.files.create({
                requestBody: {
                    name: logFilename,
                    parents: [folderId!],
                },
                media: {
                    mimeType: "application/json",
                    body,
                },
            });
        }

        console.log(`[tool] write_send_log aggiornato su Drive`);
        return { success: true };
    },
    list_drive_folder: async (input) => {
        const folderEnvKey = input.folderEnvKey as string;
        const folderId = process.env[folderEnvKey];

        if (!folderId) {
            return { error: `Variabile d'ambiente non trovata: ${folderEnvKey}` };
        }

        const auth = await getAuthClient();
        const drive = google.drive({ version: "v3", auth });

        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: "files(id, name, modifiedTime, mimeType)",
            orderBy: "modifiedTime desc",
        });

        const files = response.data.files ?? [];

        return files.map((file) => ({
            fileId: file.id,
            filename: file.name,
            lastModifiedAt: file.modifiedTime,
            mimeType: file.mimeType,
        }));
    },
    read_drive_sheet: async (input) => {
        const fileId = input.fileId as string;
        const mimeType = input.mimeType as string;

        const auth = await getAuthClient();

        // Google Sheet nativo
        if (mimeType === "application/vnd.google-apps.spreadsheet") {
            const sheets = google.sheets({ version: "v4", auth });
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: fileId,
                range: "A:Z",
            });

            const rows = response.data.values ?? [];
            if (rows.length === 0) return [];

            const headers = rows[0] as string[];
            return rows.slice(1).map((row) => {
                const obj: Record<string, string> = {};
                headers.forEach((header, i) => {
                    obj[header] = (row[i] as string) ?? "";
                });
                return obj;
            });
        }

        // CSV normale
        const drive = google.drive({ version: "v3", auth });
        const response = await drive.files.get(
            { fileId, alt: "media" },
            { responseType: "text" }
        );

        const result = Papa.parse(response.data as string, {
            header: true,
            skipEmptyLines: true,
        });

        return result.data;
    },
    create_calendar_event: async (input) => {
        const attendeeEmail = input.attendeeEmail as string;
        const attendeeName = input.attendeeName as string;
        const expiryDate = input.expiryDate as string;

        const auth = await getAuthClient();
        const calendar = google.calendar({ version: "v3", auth });

        await calendar.events.insert({
            calendarId: "primary",
            requestBody: {
                summary: `Scadenza credenziali - ${attendeeName}`,
                description: `Le credenziali di ${attendeeName} scadono oggi. Procedere con il rinnovo.`,
                start: {
                    date: expiryDate,
                    timeZone: "Europe/Rome",
                },
                end: {
                    date: expiryDate,
                    timeZone: "Europe/Rome",
                },
                attendees: [
                    { email: attendeeEmail, displayName: attendeeName }
                ],
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: "email", minutes: 4320 },  // 3 giorni prima
                        { method: "popup", minutes: 4320 },
                    ],
                },
            },
        });

        console.log(`[tool] create_calendar_event creato per: ${attendeeEmail} il ${expiryDate}`);

        return {
            success: true,
            attendeeEmail,
            expiryDate,
        };
    },
};