import { useEffect, useRef, useState } from "react";
import { streamAgentLogs } from "../../services/agentService";
import { ScrollArea } from "../ui/scroll-area";

export type AgentLogProps = {
	isRunning: boolean;
	agentKey: string;
};

function AgentLog({ isRunning, agentKey }: AgentLogProps) {
	const [logs, setLogs] = useState<string[]>([]);

	const isFirstRun = useRef(true);

	useEffect(() => {
		if (!isRunning) return;

		if (!isFirstRun.current) {
			setLogs([]);
		}
		isFirstRun.current = false;

		const cleanup = streamAgentLogs(
			(message) => setLogs((prev) => [...prev, message]),
			(status) => setLogs((prev) => [...prev, `Agente terminato con stato: ${status}`]),
		);

		return cleanup;
	}, [isRunning]);

	return (
		<div className="agent-log">
			<ScrollArea className="h-128">
				{logs.map((log, index) => (
					<div key={index} className="text-sm text-gray-700 text-start">
						<strong>{agentKey}:</strong> {log}
					</div>
				))}
			</ScrollArea>
		</div>
	);
}

export default AgentLog;
