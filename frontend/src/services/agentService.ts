const BASE_URL = "http://localhost:3000/api";

export async function getAgentStatus() {
    const response = await fetch(`${BASE_URL}/agents/status`);
    return response.json();
}

export async function runAgent(agent: string, goal?: string) {
    const response = await fetch(`${BASE_URL}/agents/${agent}/run`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ goal }),
    });
    return response.json();
}

export function streamAgentLogs(
    onMessage: (message: string) => void,
    onDone: (status: string) => void
): () => void {
    const source = new EventSource(`${BASE_URL}/agents/logs/stream`);

    source.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.done) {
            onDone(data.status);
            source.close();
        } else {
            onMessage(data.message);
        }
    };

    source.onerror = () => {
        source.close();
    };

    return () => source.close();
}