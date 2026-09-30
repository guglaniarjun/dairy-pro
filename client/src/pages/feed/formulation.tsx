import { Link } from "wouter";
import { Button } from "@/components/ui/button";
export default function FeedFormulationPage(){return <div className="max-w-3xl mx-auto p-6 space-y-4"><h1 className="text-2xl font-bold">Reviewed diet plans</h1><p>Save your nutritionist's ration by animal or group, schedule dry-period transitions, and record actual feeding with stock and cost allocation.</p><Link href="/care?tab=diets"><Button>Open diet plans</Button></Link></div>;}
