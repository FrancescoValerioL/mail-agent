import { EventEmitter } from "events";

export const agentLogger = new EventEmitter();

export function logStep(message: string) {
    console.log(message);
    agentLogger.emit("log", message);
}