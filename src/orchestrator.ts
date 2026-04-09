import { runAgent as runCredentialsAgent } from "./agents/credentials.js";

export type AgentName = "credentials";

export async function runOrchestrator(agent: AgentName, goal: string): Promise<void> {
    switch (agent) {
        case "credentials":
            await runCredentialsAgent(goal);
            break;
        default:
            throw new Error(`Agente non trovato: ${agent}`);
    }
}