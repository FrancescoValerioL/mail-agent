import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { runAgent } from "@/services/agentService";

export type AgentCardProps = {
	agentName: string;
	agentDescription: string;
	agentStatus: string;
	agentKey: string;
	onRun: () => void;
};

function AgentCard({ agentName, agentDescription, agentStatus, agentKey, onRun }: AgentCardProps) {
	const getStatusStyle = (agentStatus: string) => {
		switch (agentStatus) {
			case "running":
				return "bg-green-500 text-white";
			case "error":
			case "offline":
				return "bg-red-500 text-white";
			default:
				return "bg-slate-400 text-white";
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>{agentName}</CardTitle>
				<CardDescription>{agentDescription}</CardDescription>
				<CardAction>
					<Badge className={getStatusStyle(agentStatus)}>{agentStatus}</Badge>
				</CardAction>
			</CardHeader>
			<CardFooter className="flex-col gap-2">
				<Button
					className="w-full"
					onClick={() => {
						runAgent(agentKey);
						onRun();
					}}
					disabled={agentStatus === "running"}
				>
					Avvia
				</Button>
			</CardFooter>
		</Card>
	);
}

export default AgentCard;
