import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Database,
    Save,
    RefreshCw,
    Loader2,
    Play,
    Plus,
    Trash2,
    Download,
    FileCode
} from "lucide-react";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

const STORAGE_KEY_CONFIG = "antigravity_external_db_config";
const STORAGE_KEY_QUERIES = "antigravity_external_db_queries";

interface Query {
    id: string;
    name: string;
    sql: string;
}

const DEFAULT_QUERIES: Query[] = [
    {
        id: "q1",
        name: "Voorraad vs Gemiddeld",
        sql: `SELECT
    AfnameEmmenAVGDAY.SubCode,
    AfnameEmmenAVGDAY.SubCodeDescription,
    AfnameEmmenAVGDAY.GemVanQty,
    VoorraadEmmen.AantalVanBarcode,
    [AantalVanBarcode] - [GemVanQty] AS Verscil
FROM
    AfnameEmmenAVGDAY
    INNER JOIN VoorraadEmmen ON AfnameEmmenAVGDAY.SubCode = VoorraadEmmen.CD_SUBCODE
ORDER BY
    [AantalVanBarcode] - [GemVanQty];`
    },
    {
        id: "q2",
        name: "Gemiddeld Verbruik (Leverbonnen)",
        sql: `SELECT
    dbo_VI_WEB_DELIVERY_NOTES_DETAILS_DELIVERY.SubCode,
    dbo_VI_WEB_DELIVERY_NOTES_DETAILS_DELIVERY.SubCodeDescription,
    Int(
        Avg(dbo_VI_WEB_DELIVERY_NOTES_DETAILS_DELIVERY.Qty)
    ) AS GemVanQty
FROM
    dbo_REP05_DELIVERY_NOTES
    INNER JOIN dbo_VI_WEB_DELIVERY_NOTES_DETAILS_DELIVERY ON dbo_REP05_DELIVERY_NOTES.UI_DELIVERY_NOTE = dbo_VI_WEB_DELIVERY_NOTES_DETAILS_DELIVERY.DeliveryNoteUI
WHERE
    (
        ((Year([DT_DELIVERY])) > 2024)
        AND (
            (dbo_REP05_DELIVERY_NOTES.DS_CENTER_DESCRIPTION) = "SOL Nederland-Depot Emmen"
        )
    )
GROUP BY
    dbo_VI_WEB_DELIVERY_NOTES_DETAILS_DELIVERY.SubCode,
    dbo_VI_WEB_DELIVERY_NOTES_DETAILS_DELIVERY.SubCodeDescription
HAVING
    (
        (
            (
                dbo_VI_WEB_DELIVERY_NOTES_DETAILS_DELIVERY.SubCode
            ) LIKE "2%"
        )
    );`
    }
];

export function ExternalDatabaseSettings() {
    const [config, setConfig] = useState({
        type: "mssql", // Default to MSSQL for the user's queries
        host: "",
        port: "1433", // Default MSSQL port
        username: "",
        password: "",
        database: "",
    });
    const [queries, setQueries] = useState<Query[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    // New Query State
    const [newQueryOpen, setNewQueryOpen] = useState(false);
    const [newQueryName, setNewQueryName] = useState("");
    const [newQuerySQL, setNewQuerySQL] = useState("");

    useEffect(() => {
        const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (savedConfig) {
            try {
                setConfig(JSON.parse(savedConfig));
            } catch (e) {
                console.error("Failed to parse saved DB config", e);
            }
        }

        const savedQueries = localStorage.getItem(STORAGE_KEY_QUERIES);
        if (savedQueries) {
            try {
                setQueries(JSON.parse(savedQueries));
            } catch (e) {
                console.error("Failed to parse queries", e);
            }
        } else {
            // Load defaults if nothing saved
            setQueries(DEFAULT_QUERIES);
        }
    }, []);

    const handleChange = (field: string, value: string) => {
        setConfig((prev) => ({ ...prev, [field]: value }));
    };

    const handleSaveConfig = () => {
        setIsSaving(true);
        setTimeout(() => {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
            toast.success("Database instellingen lokaal opgeslagen");
            setIsSaving(false);
        }, 500);
    };

    const handleSaveQueries = (updatedQueries: Query[]) => {
        setQueries(updatedQueries);
        localStorage.setItem(STORAGE_KEY_QUERIES, JSON.stringify(updatedQueries));
    };

    const handleAddQuery = () => {
        if (!newQueryName || !newQuerySQL) return;
        const newQuery: Query = {
            id: crypto.randomUUID(),
            name: newQueryName,
            sql: newQuerySQL
        };
        handleSaveQueries([...queries, newQuery]);
        setNewQueryName("");
        setNewQuerySQL("");
        setNewQueryOpen(false);
        toast.success("Query toegevoegd");
    };

    const handleDeleteQuery = (id: string) => {
        handleSaveQueries(queries.filter(q => q.id !== id));
        toast.success("Query verwijderd");
    };

    const handleTestConnection = () => {
        setIsTesting(true);
        setTimeout(() => {
            if (config.host && config.username) {
                toast.success("Verbinding succesvol (simulatie)");
            } else {
                toast.error("Vul eerst alle velden in");
            }
            setIsTesting(false);
        }, 1000);
    };

    const generateRunnerScript = () => {
        const scriptContent = `
const sql = require('mssql');
const ExcelJS = require('exceljs');
const fs = require('fs');

// Configuration
const config = {
    user: '${config.username}',
    password: '${config.password.replace(/'/g, "\\'")}',
    server: '${config.host}',
    port: ${parseInt(config.port) || 1433},
    database: '${config.database}',
    options: {
        encrypt: true, // Use this if you're on Azure or require encryption
        trustServerCertificate: true // Change to false for production
    }
};

const queries = ${JSON.stringify(queries, null, 2)};

async function run() {
    try {
        console.log('Connecting to database...');
        await sql.connect(config);
        console.log('Connected!');

        const workbook = new ExcelJS.Workbook();

        for (const query of queries) {
            console.log(\`Running query: \${query.name}...\`);
            try {
                const result = await sql.query(query.sql);
                const worksheet = workbook.addWorksheet(query.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30));
                
                if (result.recordset.length > 0) {
                    // Add headers
                    const columns = Object.keys(result.recordset[0]).map(key => ({ header: key, key: key }));
                    worksheet.columns = columns;
                    
                    // Add rows
                    worksheet.addRows(result.recordset);
                }
                console.log(\`Query \${query.name} completed. Rows: \${result.recordset.length}\`);
            } catch (err) {
                console.error(\`Error running query \${query.name}: \`, err.message);
                const ws = workbook.addWorksheet(query.name.substring(0, 10) + '_ERROR');
                ws.addRow(['Error', err.message]);
            }
        }

        const filename = \`Export_\${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx\`;
        await workbook.xlsx.writeFile(filename);
        console.log(\`Done! Data exported to \${filename}\`);

        process.exit(0);
    } catch (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
}

run();
`;
        return scriptContent;
    };

    const handleDownloadScript = () => {
        const script = generateRunnerScript();
        const blob = new Blob([script], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "run_queries.js";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Script gedownload, zie instructies");
    };

    return (
        <div className="space-y-6">
            {/* Configuration Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-cyan-500" />
                        <div>
                            <CardTitle className="text-lg">Externe Database Configuratie</CardTitle>
                            <CardDescription>
                                Verbinding voor VPN/lokale netwerken
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Database Type</Label>
                            <Select
                                value={config.type}
                                onValueChange={(val) => handleChange("type", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Kies type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="mssql">SQL Server (MSSQL)</SelectItem>
                                    <SelectItem value="mysql">MySQL / MariaDB</SelectItem>
                                    <SelectItem value="postgres">PostgreSQL</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Host (IP of Domein)</Label>
                            <Input
                                value={config.host}
                                onChange={(e) => handleChange("host", e.target.value)}
                                placeholder="bv. 192.168.1.100"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Poort</Label>
                            <Input
                                value={config.port}
                                onChange={(e) => handleChange("port", e.target.value)}
                                placeholder="bv. 1433"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Database Naam</Label>
                            <Input
                                value={config.database}
                                onChange={(e) => handleChange("database", e.target.value)}
                                placeholder="bv. productie_db"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Gebruikersnaam</Label>
                            <Input
                                value={config.username}
                                onChange={(e) => handleChange("username", e.target.value)}
                                placeholder="db_user"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Wachtwoord</Label>
                            <Input
                                type="password"
                                value={config.password}
                                onChange={(e) => handleChange("password", e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between pt-4 border-t">
                        <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
                            {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Test Verbinding
                        </Button>

                        <Button onClick={handleSaveConfig} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Opslaan
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Query Management Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileCode className="h-5 w-5 text-purple-500" />
                            <div>
                                <CardTitle className="text-lg">Opgeslagen Queries</CardTitle>
                                <CardDescription>
                                    Beheer SQL queries voor export
                                </CardDescription>
                            </div>
                        </div>
                        <Dialog open={newQueryOpen} onOpenChange={setNewQueryOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Nieuwe Query
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Nieuwe Query Toevoegen</DialogTitle>
                                    <DialogDescription>
                                        Voeg een SQL query toe die uitgevoerd zal worden door het script.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Naam</Label>
                                        <Input
                                            value={newQueryName}
                                            onChange={(e) => setNewQueryName(e.target.value)}
                                            placeholder="bv. Maandrapportage"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>SQL Query</Label>
                                        <Textarea
                                            value={newQuerySQL}
                                            onChange={(e) => setNewQuerySQL(e.target.value)}
                                            placeholder="SELECT * FROM ..."
                                            className="h-64 font-mono text-xs"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleAddQuery}>Toevoegen</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {queries.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                            Geen queries opgeslagen. Voeg er een toe om te beginnen.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {queries.map((query) => (
                                <div
                                    key={query.id}
                                    className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Play className="h-4 w-4 text-muted-foreground" />
                                        <div className="truncate">
                                            <p className="font-medium truncate">{query.name}</p>
                                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                                {query.sql.substring(0, 50)}...
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteQuery(query.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="pt-4 border-t space-y-4">
                        <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                                <Download className="h-4 w-4" />
                                Instructies voor lokale uitvoer
                            </h4>
                            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                <li>Configureer de databasegegevens hierboven en sla op.</li>
                                <li>Download het runner script via de knop hieronder.</li>
                                <li>Zorg dat <strong>Node.js</strong> geïnstalleerd is op uw PC.</li>
                                <li>Open een terminal in de map waar het script staat.</li>
                                <li>Installeer benodigdheden: <code className="bg-background px-1 rounded">npm install mssql exceljs</code></li>
                                <li>Start het script: <code className="bg-background px-1 rounded">node run_queries.js</code></li>
                            </ol>
                        </div>

                        <Button className="w-full gap-2" variant="secondary" onClick={handleDownloadScript}>
                            <Download className="h-4 w-4" />
                            Download Script (run_queries.js)
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
