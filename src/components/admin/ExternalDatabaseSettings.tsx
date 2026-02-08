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
    FileCode,
    Server,
    Edit,
    MoreVertical,
    Pencil
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STORAGE_KEY_CONNECTIONS = "antigravity_external_db_connections";
const STORAGE_KEY_QUERIES = "antigravity_external_db_queries";
// Legacy key for migration
const STORAGE_KEY_LEGACY_CONFIG = "antigravity_external_db_config";

interface ConnectionConfig {
    id: string;
    name: string;
    type: string;
    host: string;
    port: string;
    username: string;
    password: string;
    database: string;
}

interface Query {
    id: string;
    connectionId: string;
    name: string;
    sql: string;
}

const DEFAULT_QUERIES: Query[] = [
    {
        id: "q1",
        connectionId: "", // Will need assignment
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
        connectionId: "", // Will need assignment
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
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [queries, setQueries] = useState<Query[]>([]);

    // Connection Dialog State
    const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
    const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);
    const [connForm, setConnForm] = useState<ConnectionConfig>({
        id: "",
        name: "",
        type: "mssql",
        host: "",
        port: "1433",
        username: "",
        password: "",
        database: ""
    });

    // Query Dialog State
    const [newQueryOpen, setNewQueryOpen] = useState(false);
    const [editingQueryId, setEditingQueryId] = useState<string | null>(null);
    const [queryForm, setQueryForm] = useState<{ name: string, sql: string, connectionId: string }>({
        name: "",
        sql: "",
        connectionId: ""
    });

    useEffect(() => {
        // Load Connections
        const savedConnections = localStorage.getItem(STORAGE_KEY_CONNECTIONS);
        if (savedConnections) {
            try {
                setConnections(JSON.parse(savedConnections));
            } catch (e) {
                console.error("Failed to parse connections", e);
            }
        } else {
            // Migrate legacy single config if exists
            const legacyConfig = localStorage.getItem(STORAGE_KEY_LEGACY_CONFIG);
            if (legacyConfig) {
                try {
                    const conf = JSON.parse(legacyConfig);
                    const newConn: ConnectionConfig = {
                        id: crypto.randomUUID(),
                        name: "Default Connection",
                        ...conf
                    };
                    setConnections([newConn]);
                    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify([newConn]));
                } catch (e) {
                    console.error("Failed to migrate legacy config", e);
                }
            }
        }

        // Load Queries
        const savedQueries = localStorage.getItem(STORAGE_KEY_QUERIES);
        if (savedQueries) {
            try {
                setQueries(JSON.parse(savedQueries));
            } catch (e) {
                console.error("Failed to parse queries", e);
            }
        } else {
            setQueries(DEFAULT_QUERIES);
        }
    }, []);

    const saveConnections = (newConns: ConnectionConfig[]) => {
        setConnections(newConns);
        localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(newConns));
    };

    const saveQueries = (newQueries: Query[]) => {
        setQueries(newQueries);
        localStorage.setItem(STORAGE_KEY_QUERIES, JSON.stringify(newQueries));
    };

    // --- Connection Handlers ---

    const handleOpenAddConnection = () => {
        setEditingConnection(null);
        setConnForm({
            id: crypto.randomUUID(),
            name: "",
            type: "mssql",
            host: "",
            port: "1433",
            username: "",
            password: "",
            database: ""
        });
        setIsConnectionDialogOpen(true);
    };

    const handleEditConnection = (conn: ConnectionConfig) => {
        setEditingConnection(conn);
        setConnForm({ ...conn });
        setIsConnectionDialogOpen(true);
    };

    const handleDeleteConnection = (id: string) => {
        const updated = connections.filter(c => c.id !== id);
        saveConnections(updated);
        toast.success("Connectie verwijderd");
    };

    const handleSaveConnection = () => {
        if (!connForm.name || !connForm.host) {
            toast.error("Naam en Host zijn verplicht");
            return;
        }

        let updatedConns = [...connections];
        if (editingConnection) {
            updatedConns = updatedConns.map(c => c.id === editingConnection.id ? connForm : c);
        } else {
            updatedConns.push(connForm);
        }

        saveConnections(updatedConns);
        setIsConnectionDialogOpen(false);
        toast.success(editingConnection ? "Connectie bijgewerkt" : "Connectie toegevoegd");
    };

    // --- Query Handlers ---

    const handleOpenAddQuery = () => {
        setEditingQueryId(null);
        setQueryForm({ name: "", sql: "", connectionId: "" });
        setNewQueryOpen(true);
    };

    const handleEditQuery = (query: Query) => {
        setEditingQueryId(query.id);
        setQueryForm({
            name: query.name,
            sql: query.sql,
            connectionId: query.connectionId
        });
        setNewQueryOpen(true);
    };

    const handleSaveQuery = () => {
        if (!queryForm.name || !queryForm.sql) {
            toast.error("Naam en SQL zijn verplicht");
            return;
        }

        let targetConnId = queryForm.connectionId;
        if (!targetConnId && connections.length === 1) {
            targetConnId = connections[0].id;
        }

        if (!targetConnId && connections.length > 0) {
            toast.error("Selecteer een connectie");
            return;
        }

        if (editingQueryId) {
            // Update existing
            const updatedQueries = queries.map(q =>
                q.id === editingQueryId
                    ? { ...q, ...queryForm, connectionId: targetConnId }
                    : q
            );
            saveQueries(updatedQueries);
            toast.success("Query bijgewerkt");
        } else {
            // Create new
            const newQuery: Query = {
                id: crypto.randomUUID(),
                connectionId: targetConnId,
                name: queryForm.name,
                sql: queryForm.sql
            };
            saveQueries([...queries, newQuery]);
            toast.success("Query toegevoegd");
        }

        setNewQueryOpen(false);
    };

    const handleDeleteQuery = (id: string) => {
        saveQueries(queries.filter(q => q.id !== id));
        toast.success("Query verwijderd");
    };

    const handleUpdateQueryConnection = (queryId: string, connId: string) => {
        const updated = queries.map(q => q.id === queryId ? { ...q, connectionId: connId } : q);
        saveQueries(updated);
    };

    // --- Script Generation ---

    const generateRunnerScript = () => {
        // 1. Group queries by connection
        // Filter connections that are actually used or just pass all? Pass all.
        const connectionsMap = connections.reduce((acc, conn) => {
            acc[conn.id] = conn;
            return acc;
        }, {} as Record<string, ConnectionConfig>);

        // We need to ensure queries have valid connections
        const validQueries = queries.filter(q => connectionsMap[q.connectionId] || (!q.connectionId && connections.length === 1));

        const scriptContent = `
const sql = require('mssql');
const ExcelJS = require('exceljs');
const fs = require('fs');

// --- Configurations ---
const connections = ${JSON.stringify(connections, null, 2)};
const queries = ${JSON.stringify(validQueries, null, 2)};

async function run() {
    const workbook = new ExcelJS.Workbook();
    console.log('Starting execution...');

    // We will iterate over connections to reuse pools if multiple queries share a connection
    // But simplistic approach: iterate queries and connect on demand (or group by connection)

    // Better: Group queries by Connection ID
    const queriesByConn = {};
    for (const q of queries) {
        // Fallback for single connection scenario
        const connId = q.connectionId || (connections.length === 1 ? connections[0].id : null);
        if (!connId) {
            console.warn(\`Skipping query "\${q.name}" (No connection assigned)\`);
            continue;
        }
        if (!queriesByConn[connId]) queriesByConn[connId] = [];
        queriesByConn[connId].push(q);
    }

    for (const [connId, connQueries] of Object.entries(queriesByConn)) {
        const connConfig = connections.find(c => c.id === connId);
        if (!connConfig) {
             console.error(\`Connection config not found for ID \${connId}\`);
             continue;
        }

        console.log(\`\\n--- Connecting to \${connConfig.name} (\${connConfig.host}) ---\`);

        const sqlConfig = {
            user: connConfig.username,
            password: connConfig.password,
            server: connConfig.host,
            port: parseInt(connConfig.port) || 1433,
            database: connConfig.database,
            options: {
                encrypt: true,
                trustServerCertificate: true
            }
        };

        let pool = null;
        try {
            pool = await new sql.ConnectionPool(sqlConfig).connect();
            console.log('Connected!');

            for (const query of connQueries) {
                console.log(\`Running query: \${query.name}...\`);
                try {
                    const result = await pool.request().query(query.sql);
                    const safeName = query.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30) || 'Query';
                    const worksheet = workbook.addWorksheet(safeName);

                    if (result.recordset && result.recordset.length > 0) {
                        const columns = Object.keys(result.recordset[0]).map(key => ({ header: key, key: key }));
                        worksheet.columns = columns;
                        worksheet.addRows(result.recordset);
                    }
                    console.log(\`  -> Rows: \${result.recordset ? result.recordset.length : 0}\`);
                } catch (err) {
                    console.error(\`  -> Error: \${err.message}\`);
                    // Create error sheet if needed
                    const ws = workbook.addWorksheet(query.name.substring(0, 10) + '_ERROR');
                    ws.addRow(['Error', err.message]);
                }
            }

        } catch (err) {
            console.error(\`Failed to connect to \${connConfig.name}: \`, err.message);
        } finally {
            if (pool) await pool.close();
        }
    }

    const filename = \`Export_\${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx\`;
    await workbook.xlsx.writeFile(filename);
    console.log(\`\\nDone! Data exported to \${filename}\`);
}

run().catch(console.error);
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
        toast.success("Script gedownload");
    };

    return (
        <div className="space-y-6">
            {/* Connections Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Server className="h-5 w-5 text-cyan-500" />
                            <div>
                                <CardTitle className="text-lg">Database Connecties</CardTitle>
                                <CardDescription>Beheer uw database connecties</CardDescription>
                            </div>
                        </div>
                        <Button size="sm" onClick={handleOpenAddConnection} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nieuwe Connectie
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {connections.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                            Geen connecties geconfigureerd.
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {connections.map((conn) => (
                                <div key={conn.id} className="border rounded-lg p-4 bg-card hover:border-cyan-500/50 transition-colors relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <Database className="h-4 w-4 text-cyan-500" />
                                            <span className="font-semibold">{conn.name}</span>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => handleEditConnection(conn)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Bewerken
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDeleteConnection(conn.id)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Verwijderen
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                        <p>{conn.type}://{conn.host}:{conn.port}</p>
                                        <p>User: {conn.username}</p>
                                        <p>Database: {conn.database}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Query Management Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileCode className="h-5 w-5 text-purple-500" />
                            <div>
                                <CardTitle className="text-lg">Opgeslagen Queries</CardTitle>
                                <CardDescription>Beheer en koppel queries aan connecties</CardDescription>
                            </div>
                        </div>
                        <Dialog open={newQueryOpen} onOpenChange={setNewQueryOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-2" onClick={handleOpenAddQuery}>
                                    <Plus className="h-4 w-4" />
                                    Nieuwe Query
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>{editingQueryId ? 'Query Bewerken' : 'Nieuwe Query Toevoegen'}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Naam</Label>
                                            <Input
                                                value={queryForm.name}
                                                onChange={(e) => setQueryForm({ ...queryForm, name: e.target.value })}
                                                placeholder="bv. Maandrapportage"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Connectie</Label>
                                            <Select
                                                value={queryForm.connectionId}
                                                onValueChange={(val) => setQueryForm({ ...queryForm, connectionId: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Kies connectie" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {connections.map(c => (
                                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>SQL Query</Label>
                                        <Textarea
                                            value={queryForm.sql}
                                            onChange={(e) => setQueryForm({ ...queryForm, sql: e.target.value })}
                                            placeholder="SELECT * FROM ..."
                                            className="h-64 font-mono text-xs"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleSaveQuery}>
                                        {editingQueryId ? 'Opslaan' : 'Toevoegen'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {queries.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">Geen queries.</div>
                        ) : queries.map((query) => (
                            <div
                                key={query.id}
                                className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                            >
                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                    <Play className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="grid gap-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium truncate">{query.name}</p>
                                            <Select
                                                value={query.connectionId}
                                                onValueChange={(val) => handleUpdateQueryConnection(query.id, val)}
                                            >
                                                <SelectTrigger className="h-6 w-[150px] text-xs">
                                                    <SelectValue placeholder="Selecteer DB" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {connections.map(c => (
                                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate font-mono">
                                            {query.sql.substring(0, 60)}...
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditQuery(query)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteQuery(query.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 mt-4 border-t">
                        <Button className="w-full gap-2" variant="secondary" onClick={handleDownloadScript}>
                            <Download className="h-4 w-4" />
                            Download Script (run_queries.js)
                        </Button>
                        <p className="text-xs text-center text-muted-foreground mt-2">
                            Dit script zal verbinding maken met alle geconfigureerde databases en de queries uitvoeren.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Connection Edit Dialog */}
            <Dialog open={isConnectionDialogOpen} onOpenChange={setIsConnectionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingConnection ? 'Connectie Bewerken' : 'Nieuwe Connectie'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Naam</Label>
                                <Input
                                    value={connForm.name}
                                    onChange={(e) => setConnForm({ ...connForm, name: e.target.value })}
                                    placeholder="bv. Magazijn"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select
                                    value={connForm.type}
                                    onValueChange={(val) => setConnForm({ ...connForm, type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mssql">SQL Server</SelectItem>
                                        <SelectItem value="mysql">MySQL</SelectItem>
                                        <SelectItem value="postgres">PostgreSQL</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Host</Label>
                            <Input
                                value={connForm.host}
                                onChange={(e) => setConnForm({ ...connForm, host: e.target.value })}
                                placeholder="bv. 192.168.1.100"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Poort</Label>
                                <Input
                                    value={connForm.port}
                                    onChange={(e) => setConnForm({ ...connForm, port: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Database</Label>
                                <Input
                                    value={connForm.database}
                                    onChange={(e) => setConnForm({ ...connForm, database: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Gebruikersnaam</Label>
                                <Input
                                    value={connForm.username}
                                    onChange={(e) => setConnForm({ ...connForm, username: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Wachtwoord</Label>
                                <Input
                                    type="password"
                                    value={connForm.password}
                                    onChange={(e) => setConnForm({ ...connForm, password: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveConnection}>Opslaan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
