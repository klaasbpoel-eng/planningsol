import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Rocket, ExternalLink, Database } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function DeploymentControl() {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSource, setSelectedSource] = useState<string>("cloud");

    const handleDeploy = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('trigger-github-workflow', {
                body: {
                    primary_source: selectedSource
                }
            });

            if (error) {
                // Parse error body if possible
                let errorMessage = "Er is een fout opgetreden";
                try {
                    const body = JSON.parse(await error.context.json());
                    errorMessage = body.error || errorMessage;
                } catch (e) {
                    errorMessage = error.message;
                }
                throw new Error(errorMessage);
            }

            toast.success("Deployment gestart! Check GitHub Actions voor de voortgang.");
        } catch (error: any) {
            console.error('Deployment error:', error);
            toast.error(error.message || "Er is een fout opgetreden bij het starten van de deployment.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5" />
                    Automatische Deployment
                </CardTitle>
                <CardDescription>
                    Start hier handmatig een nieuwe build en deploy naar de productieomgeving.
                    Dit proces duurt meestal 2-3 minuten.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-md text-sm">
                    <strong>Belangrijk:</strong> Dit triggert een nieuwe build van de <em>huidige code in GitHub</em>.
                    Zorg ervoor dat je alle lokale wijzigingen eerst hebt gesynchroniseerd ("Sync to GitHub").
                </div>

                <div className="space-y-2">
                    <Label>Kies doel-database configuratie</Label>
                    <Select value={selectedSource} onValueChange={setSelectedSource}>
                        <SelectTrigger className="w-full md:w-[300px]">
                            <SelectValue placeholder="Kies database..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cloud">
                                <span className="flex items-center gap-2">
                                    <Database className="h-4 w-4" />
                                    Lovable Cloud (Standaard)
                                </span>
                            </SelectItem>
                            <SelectItem value="external_supabase">
                                <span className="flex items-center gap-2">
                                    <Database className="h-4 w-4 text-blue-500" />
                                    Externe Supabase
                                </span>
                            </SelectItem>
                            <SelectItem value="mysql">
                                <span className="flex items-center gap-2">
                                    <Database className="h-4 w-4 text-orange-500" />
                                    MySQL
                                </span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        De geselecteerde database wordt ingesteld als primaire databron voor de nieuwe deployment.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                    <Button onClick={handleDeploy} disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Bezig met starten...
                            </>
                        ) : (
                            "Start Deployment"
                        )}
                    </Button>

                    <a
                        href="https://github.com/klaasbpoel-eng/planningsol/actions"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                        Bekijk voortgang op GitHub <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            </CardContent>
        </Card>
    );
}
