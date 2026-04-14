import { runAgent as runCredentialsAgent } from "./agents/credentials.js";
import { runAgent as runDocumentSummarizerAgent } from "./agents/document-summarizer.js";

export type AgentName = "credentials" | "document-summarizer";

export async function runOrchestrator(agent: AgentName, goal: string): Promise<void> {
    switch (agent) {
        case "credentials":
            await runCredentialsAgent(goal);
            break;
        case "document-summarizer":
            await runDocumentSummarizerAgent(goal);
            break;
        default:
            throw new Error(`Agente non trovato: ${agent}`);
    }
}