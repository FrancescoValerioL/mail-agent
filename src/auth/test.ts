import "dotenv/config";
import { getAuthClient } from "./google.js";

async function main() {
    const auth = await getAuthClient();
    console.log("✅ Autenticazione riuscita!");
}

main().catch(console.error);