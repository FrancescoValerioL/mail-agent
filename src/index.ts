import "dotenv/config";
import { runOrchestrator, AgentName } from "./orchestrator.js";

const agent = (process.argv[2] as AgentName) ?? "credentials";
const goal = process.argv[3] ?? "Processa la cartella data/ e invia le mail";

runOrchestrator(agent, goal).catch(console.error);