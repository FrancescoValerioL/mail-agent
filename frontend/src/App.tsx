import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function App() {
	return (
		<div className="p-8 space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Mail Agent</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<Badge>Test badge</Badge>
					<div>
						<Button>Avvia agente</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default App;
