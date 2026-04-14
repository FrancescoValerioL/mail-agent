import { useEffect, useState } from "react";
import AgentCard from "./components/AgentCard/AgentCard";
import { getAgentStatus } from "./services/agentService";
import AgentLog from "./components/AgentLog/AgentLog";

function App() {
	const [agentStatuses, setAgentStatuses] = useState<Record<string, string>>({
		credentials: "offline",
		"document-summarizer": "offline",
	});
	const [activeAgentKey, setActiveAgentKey] = useState<string>("credentials");

	useEffect(() => {
		const fetchStatus = () => {
			getAgentStatus()
				.then((data) => {
					if (data) {
						setAgentStatuses((prev) => {
							const next = { ...prev };
							Object.keys(next).forEach((k) => {
								next[k] = "idle";
							});
							if (data.running && data.lastRunAgent) {
								next[data.lastRunAgent] = "running";
							}
							return next;
						});
					} else {
						setAgentStatuses({
							credentials: "offline",
							"document-summarizer": "offline",
						});
					}
				})
				.catch(() =>
					setAgentStatuses({
						credentials: "offline",
						"document-summarizer": "offline",
					}),
				);
		};

		fetchStatus();
		const interval = setInterval(fetchStatus, 5000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="p-8  w-full">
			<div className="row flex justify-around">
				<AgentCard
					agentName="Mail Agent"
					agentDescription="Gestisce l'invio di mail per credenziali in scadenza"
					agentStatus={agentStatuses["credentials"]}
					agentKey="credentials"
					onRun={() => {
						setAgentStatuses((prev) => ({ ...prev, credentials: "running" }));
						setActiveAgentKey("credentials");
					}}
				/>
				<AgentCard
					agentName="Document Summarizer"
					agentDescription="Riassume e invia documenti PDF"
					agentStatus={agentStatuses["document-summarizer"]}
					agentKey="document-summarizer"
					onRun={() => {
						setAgentStatuses((prev) => ({ ...prev, "document-summarizer": "running" }));
						setActiveAgentKey("document-summarizer");
					}}
				/>
			</div>
			<div className="row py-3">
				<AgentLog isRunning={Object.values(agentStatuses).some((s) => s === "running")} agentKey={activeAgentKey} />
			</div>
		</div>
	);
}

export default App;
