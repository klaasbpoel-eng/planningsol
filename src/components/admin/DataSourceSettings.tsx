import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Database, Save, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const STORAGE_KEY_DATA_SOURCE = "antigravity_data_source_config";

export interface DataSourceConfig {
    useMySQL: boolean;
    mysqlHost: string;
    mysqlPort: string;
    mysqlUser: string;
    mysqlPassword: string;
    mysqlDatabase: string;
}

const DEFAULT_CONFIG: DataSourceConfig = {
    useMySQL: false,
    mysqlHost: "",
    mysqlPort: "3306",
    mysqlUser: "",
    mysqlPassword: "",
    mysqlDatabase: "",
};

export function DataSourceSettings() {
    const [config, setConfig] = useState<DataSourceConfig>(DEFAULT_CONFIG);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY_DATA_SOURCE);
        if (saved) {
            try {
                setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Failed to parse data source config", e);
            }
        }
    }, []);

    const handleChange = (key: keyof DataSourceConfig, value: string | boolean) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        localStorage.setItem(STORAGE_KEY_DATA_SOURCE, JSON.stringify(config));
        toast.success("Instellingen opgeslagen");
        // Reload to apply changes globally if needed, or rely on context/events. 
        // For now, simple reload is safest to ensure all components pick up new config.
        setTimeout(() => window.location.reload(), 1000);
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try {
            const { data, error } = await supabase.functions.invoke('query-mysql', {
                body: {
                    host: config.mysqlHost,
                    port: parseInt(config.mysqlPort),
                    user: config.mysqlUser,
                    password: config.mysqlPassword,
                    database: config.mysqlDatabase,
                    query: "SELECT 1 as connected",
                }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            toast.success("Verbinding succesvol!");
        } catch (err) {
            toast.error(`Verbinding mislukt: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setTesting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Primaire Databron
                </CardTitle>
                <CardDescription>
                    Kies of u Supabase (Cloud) of uw eigen MySQL database wilt gebruiken.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg">
                    <Label htmlFor="use-mysql" className="flex flex-col space-y-1">
                        <span>Gebruik Externe MySQL Database</span>
                        <span className="font-normal text-xs text-muted-foreground">
                            Schakel dit in om data uit uw eigen MySQL server te lezen en schrijven.
                        </span>
                    </Label>
                    <Switch
                        id="use-mysql"
                        checked={config.useMySQL}
                        onCheckedChange={(c) => handleChange("useMySQL", c)}
                    />
                </div>

                {config.useMySQL && (
                    <div className="space-y-4 border-t pt-4 animate-in fade-in slide-in-from-top-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Host</Label>
                                <Input
                                    value={config.mysqlHost}
                                    onChange={e => handleChange("mysqlHost", e.target.value)}
                                    placeholder="localhost of IP"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Poort</Label>
                                <Input
                                    value={config.mysqlPort}
                                    onChange={e => handleChange("mysqlPort", e.target.value)}
                                    placeholder="3306"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Gebruikersnaam</Label>
                                <Input
                                    value={config.mysqlUser}
                                    onChange={e => handleChange("mysqlUser", e.target.value)}
                                    placeholder="root"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Wachtwoord</Label>
                                <Input
                                    type="password"
                                    value={config.mysqlPassword}
                                    onChange={e => handleChange("mysqlPassword", e.target.value)}
                                    placeholder="********"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Database Naam</Label>
                            <Input
                                value={config.mysqlDatabase}
                                onChange={e => handleChange("mysqlDatabase", e.target.value)}
                                placeholder="mijn_database"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                                <Activity className={`mr-2 h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
                                Test Verbinding
                            </Button>
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" />
                        Opslaan & Herladen
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
