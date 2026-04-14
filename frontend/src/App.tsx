import { useEffect, useState } from "react";
import AgentCard from "./components/AgentCard/AgentCard";
import { getAgentStatus } from "./services/agentService";
import AgentLog from "./components/AgentLog/AgentLog";

function App() {
	const [status, setStatus] = useState<string>("offline");
	useEffect(() => {
		const fetchStatus = () => {
			getAgentStatus()
				.then((data) => {
					if (data) {
						setStatus(data.running ? "running" : "idle");
					} else {
						setStatus("offline");
					}
				})
				.catch(() => setStatus("offline"));
		};
		fetchStatus(); // chiamata immediata al mount
		const interval = setInterval(fetchStatus, 5000); // poi ogni 5 secondi

		return () => clearInterval(interval);
	}, []);
	return (
		<div className="p-8 space-y-4">
			<AgentCard
				agentName="Mail Agent"
				agentDescription="This is a simple mail agent"
				agentStatus={status}
				agentKey="credentials"
				onRun={() => setStatus("running")}
			></AgentCard>
			<AgentLog isRunning={status === "running"} agentKey="credentials" />
		</div>
	);
}

export default App;
