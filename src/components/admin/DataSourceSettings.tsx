import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Database, Save, Activity, Cloud, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const STORAGE_KEY_DATA_SOURCE = "antigravity_data_source_config";

export type PrimarySource = "cloud" | "external_supabase" | "mysql";

export interface DataSourceConfig {
    primarySource: PrimarySource;
    useMySQL: boolean;
    mysqlHost: string;
    mysqlPort: string;
    mysqlUser: string;
    mysqlPassword: string;
    mysqlDatabase: string;
    useExternalSupabase: boolean;
    externalSupabaseUrl: string;
    externalSupabaseAnonKey: string;
}

const DEFAULT_CONFIG: DataSourceConfig = {
    primarySource: (import.meta.env.VITE_DEFAULT_PRIMARY_SOURCE as PrimarySource) || "cloud",
    useMySQL: false,
    mysqlHost: "",
    mysqlPort: "3306",
    mysqlUser: "",
    mysqlPassword: "",
    mysqlDatabase: "",
    useExternalSupabase: false,
    externalSupabaseUrl: "",
    externalSupabaseAnonKey: "",
};

export function DataSourceSettings() {
    const [config, setConfig] = useState<DataSourceConfig>(DEFAULT_CONFIG);
    const [testing, setTesting] = useState(false);
    const [testingSupabase, setTestingSupabase] = useState(false);

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

    const handleTestExternalSupabase = async () => {
        setTestingSupabase(true);
        try {
            if (!config.externalSupabaseUrl || !config.externalSupabaseAnonKey) {
                throw new Error("Vul URL en Anon Key in");
            }
            const extClient = createClient(config.externalSupabaseUrl, config.externalSupabaseAnonKey);
            const { error } = await extClient.from("customers").select("id").limit(1);
            if (error) throw error;
            toast.success("Externe Supabase verbinding succesvol!");
        } catch (err) {
            toast.error(`Verbinding mislukt: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setTestingSupabase(false);
        }
    };

    const isMySQLConfigured = !!(config.mysqlHost && config.mysqlUser && config.mysqlPassword && config.mysqlDatabase);
    const isExternalSupabaseConfigured = !!(config.externalSupabaseUrl && config.externalSupabaseAnonKey);

    const showPrimaryWarning =
        (config.primarySource === "mysql" && !isMySQLConfigured) ||
        (config.primarySource === "external_supabase" && !isExternalSupabaseConfigured);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Databron Instellingen
                </CardTitle>
                <CardDescription>
                    Kies uw primaire databron en configureer optionele synchronisatie.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Primary Source Selection */}
                <div className="space-y-3 border p-4 rounded-lg">
                    <Label className="text-base font-semibold">Primaire Databron</Label>
                    <p className="text-xs text-muted-foreground">
                        Bepaalt welke database wordt gebruikt voor alle lees-, schrijf- en verwijderoperaties.
                    </p>
                    <RadioGroup
                        value={config.primarySource}
                        onValueChange={(v) => handleChange("primarySource", v)}
                        className="grid gap-3 pt-1"
                    >
                        <div className="flex items-center space-x-3">
                            <RadioGroupItem value="cloud" id="primary-cloud" />
                            <Label htmlFor="primary-cloud" className="flex flex-col cursor-pointer">
                                <span className="font-medium">Lovable Cloud (standaard)</span>
                                <span className="text-xs text-muted-foreground">De ingebouwde cloud database</span>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-3">
                            <RadioGroupItem value="external_supabase" id="primary-ext-sb" />
                            <Label htmlFor="primary-ext-sb" className="flex flex-col cursor-pointer">
                                <span className="font-medium">Externe Supabase</span>
                                <span className="text-xs text-muted-foreground">Een zelf geconfigureerde Supabase-instantie</span>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-3">
                            <RadioGroupItem value="mysql" id="primary-mysql" />
                            <Label htmlFor="primary-mysql" className="flex flex-col cursor-pointer">
                                <span className="font-medium">MySQL</span>
                                <span className="text-xs text-muted-foreground">Een externe MySQL server (geen RLS-beveiliging)</span>
                            </Label>
                        </div>
                    </RadioGroup>

                    {showPrimaryWarning && (
                        <Alert variant="destructive" className="mt-3">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                {config.primarySource === "mysql"
                                    ? "MySQL is geselecteerd als primaire bron, maar de verbindingsgegevens zijn niet (volledig) ingevuld. Configureer deze hieronder."
                                    : "Externe Supabase is geselecteerd als primaire bron, maar de URL en/of Anon Key zijn niet ingevuld. Configureer deze hieronder."}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                {/* MySQL Toggle */}
                <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg">
                    <Label htmlFor="use-mysql" className="flex flex-col space-y-1">
                        <span>MySQL Synchronisatie</span>
                        <span className="font-normal text-xs text-muted-foreground">
                            Synchroniseer data naar uw eigen MySQL server (naast de primaire bron).
                        </span>
                    </Label>
                    <Switch
                        id="use-mysql"
                        checked={config.useMySQL}
                        onCheckedChange={(c) => handleChange("useMySQL", c)}
                    />
                </div>

                {(config.useMySQL || config.primarySource === "mysql") && (
                    <div className="space-y-4 border-t pt-4 animate-in fade-in slide-in-from-top-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Host</Label>
                                <Input
                                    value={config.mysqlHost}
                                    onChange={e => handleChange("mysqlHost", e.target.value)}
                                    onBlur={e => {
                                        let h = e.target.value.trim();
                                        h = h.replace(/^https?:\/\//i, "");
                                        h = h.replace(/[?#].*$/, "");
                                        h = h.replace(/\/.*$/, "");
                                        h = h.replace(/:\d+$/, "");
                                        if (h !== config.mysqlHost) {
                                            handleChange("mysqlHost", h);
                                        }
                                    }}
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

                {/* External Supabase Toggle */}
                <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg">
                    <Label htmlFor="use-external-supabase" className="flex flex-col space-y-1">
                        <span>Externe Supabase Synchronisatie</span>
                        <span className="font-normal text-xs text-muted-foreground">
                            Synchroniseer data naar een externe Supabase instantie (naast de primaire bron).
                        </span>
                    </Label>
                    <Switch
                        id="use-external-supabase"
                        checked={config.useExternalSupabase}
                        onCheckedChange={(c) => handleChange("useExternalSupabase", c)}
                    />
                </div>

                {(config.useExternalSupabase || config.primarySource === "external_supabase") && (
                    <div className="space-y-4 border-t pt-4 animate-in fade-in slide-in-from-top-4">
                        <div className="space-y-2">
                            <Label>Supabase URL</Label>
                            <Input
                                value={config.externalSupabaseUrl}
                                onChange={e => handleChange("externalSupabaseUrl", e.target.value)}
                                placeholder="https://xxxxx.supabase.co"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Anon Key</Label>
                            <Input
                                type="password"
                                value={config.externalSupabaseAnonKey}
                                onChange={e => handleChange("externalSupabaseAnonKey", e.target.value)}
                                placeholder="eyJhbGciOiJIUzI1NiIs..."
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={handleTestExternalSupabase} disabled={testingSupabase}>
                                <Cloud className={`mr-2 h-4 w-4 ${testingSupabase ? 'animate-spin' : ''}`} />
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
