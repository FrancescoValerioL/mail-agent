import "dotenv/config";
import express from "express";
import cors from "cors";
import { runOrchestrator, AgentName } from "./orchestrator.js";
import { agentLogger } from "./logger.js";

const app = express();
const PORT = 3000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Stato dell'agente
let agentRunning = false;
let lastRunAt: string | null = null;
let lastRunAgent: string | null = null;
let lastRunStatus: "success" | "error" | null = null;

// POST /api/agents/:agent/run — avvia un agente
app.post("/api/agents/:agent/run", async (req, res) => {
    const agent = req.params.agent as AgentName;
    const goal = req.body.goal as string | undefined;

    if (agentRunning) {
        res.status(409).json({ error: "Un agente è già in esecuzione" });
        return;
    }

    agentRunning = true;
    lastRunAgent = agent;
    lastRunAt = new Date().toISOString();
    lastRunStatus = null;

    res.json({ success: true, message: `Agente ${agent} avviato` });

    // Esegui in background
    runOrchestrator(agent, goal ?? "Processa la cartella Drive e invia le mail")
        .then(() => {
            lastRunStatus = "success";
            agentLogger.emit("log", "✅ Agente completato con successo");
        })
        .catch((err) => {
            lastRunStatus = "error";
            agentLogger.emit("log", `❌ Errore: ${err.message}`);
        })
        .finally(() => {
            agentRunning = false;
            agentLogger.emit("done", lastRunStatus);
        });
});

// GET /api/agents/status — stato ultimo run
app.get("/api/agents/status", (_req, res) => {
    res.json({
        running: agentRunning,
        lastRunAt,
        lastRunAgent,
        lastRunStatus,
    });
});

// GET /api/agents/logs/stream — SSE streaming log in tempo reale
app.get("/api/agents/logs/stream", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const onLog = (message: string) => {
        res.write(`data: ${JSON.stringify({ message })}\n\n`);
    };

    const onDone = (status: string) => {
        res.write(`data: ${JSON.stringify({ done: true, status })}\n\n`);
        res.end();
    };

    agentLogger.on("log", onLog);
    agentLogger.once("done", onDone);

    // Cleanup se il client si disconnette
    res.on("close", () => {
        agentLogger.off("log", onLog);
        agentLogger.off("done", onDone);
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server in ascolto su http://localhost:${PORT}`);
});