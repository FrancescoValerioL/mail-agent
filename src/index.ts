import "dotenv/config";
import { runAgent } from "./agent.js";

const goal = process.argv[2] ??
    "Leggi il file users.csv e dimmi quanti utenti ci sono per categoria";

runAgent(goal).catch(console.error);