import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Download, ArrowRightLeft, Database, Key, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// --- Types ---
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

const STORAGE_KEY_CONNECTIONS = "antigravity_external_db_connections";

// --- Schema Definitions (Simplified for Migration) ---
// We define the extensive schema here to generate correct CREATE TABLE statements
const TABLE_SCHEMAS: Record<string, string> = {
    customers: `
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at DATETIME,
    updated_at DATETIME
  `,
    orders: `
    id VARCHAR(36) PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL,
    customer_id VARCHAR(36),
    customer_name VARCHAR(255),
    status VARCHAR(50),
    delivery_date DATETIME,
    notes TEXT,
    created_by VARCHAR(36),
    created_at DATETIME,
    updated_at DATETIME
  `,
    order_items: `
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36),
    product_id VARCHAR(36),
    product_name VARCHAR(255),
    article_code VARCHAR(50),
    quantity INT,
    notes TEXT,
    created_at DATETIME
  `,
    gas_cylinder_orders: `
    id VARCHAR(36) PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL,
    customer_id VARCHAR(36),
    customer_name VARCHAR(255),
    location VARCHAR(50),
    gas_type VARCHAR(50),
    cylinder_size VARCHAR(50),
    gas_grade VARCHAR(50),
    pressure FLOAT,
    cylinder_count INT,
    scheduled_date DATETIME,
    status VARCHAR(50),
    notes TEXT,
    assigned_to VARCHAR(36),
    created_by VARCHAR(36),
    created_at DATETIME,
    updated_at DATETIME
  `,
    dry_ice_orders: `
    id VARCHAR(36) PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL,
    customer_id VARCHAR(36),
    customer_name VARCHAR(255),
    location VARCHAR(50),
    product_type VARCHAR(50),
    quantity_kg FLOAT,
    box_count INT,
    container_has_wheels BOOLEAN,
    scheduled_date DATETIME,
    status VARCHAR(50),
    notes TEXT,
    assigned_to VARCHAR(36),
    created_by VARCHAR(36),
    created_at DATETIME,
    updated_at DATETIME
  `,
    products: `
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    article_code VARCHAR(50),
    description TEXT,
    category_id VARCHAR(36),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
  `,
    profiles: `
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME
  `
};

const AVAILABLE_TABLES = Object.keys(TABLE_SCHEMAS);

export function MigrationSettings() {
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [targetConnectionId, setTargetConnectionId] = useState<string>("");

    const [supabaseUrl, setSupabaseUrl] = useState(import.meta.env.VITE_SUPABASE_URL || "");
    const [supabaseKey, setSupabaseKey] = useState("");

    const [selectedTables, setSelectedTables] = useState<string[]>(AVAILABLE_TABLES);

    useEffect(() => {
        const savedConnections = localStorage.getItem(STORAGE_KEY_CONNECTIONS);
        if (savedConnections) {
            try {
                setConnections(JSON.parse(savedConnections));
            } catch (e) {
                console.error("Failed to parse connections", e);
            }
        }
    }, []);

    const handleToggleTable = (table: string) => {
        setSelectedTables(prev =>
            prev.includes(table)
                ? prev.filter(t => t !== table)
                : [...prev, table]
        );
    };

    const handleSelectAll = (checked: boolean) => {
        setSelectedTables(checked ? AVAILABLE_TABLES : []);
    };

    const generateMigrationScript = () => {
        const targetConn = connections.find(c => c.id === targetConnectionId);
        if (!targetConn) {
            toast.error("Selecteer een doel database");
            return;
        }
        if (!supabaseUrl || !supabaseKey) {
            toast.error("Supabase URL en Key zijn vereist");
            return;
        }

        const script = `
const { createClient } = require('@supabase/supabase-js');
const sql = require('mssql');
const mysql = require('mysql2/promise');
const { Client } = require('pg');

// --- CONFIGURATION ---
const SUPABASE_URL = "${supabaseUrl}";
const SUPABASE_KEY = "${supabaseKey}"; // Ensure this is the SERVICE_ROLE key for full access
const TARGET_DB_TYPE = "${targetConn.type}"; // 'mssql', 'mysql', 'postgres'
const TARGET_CONFIG = {
  host: "${targetConn.host}",
  port: ${parseInt(targetConn.port) || 1433},
  user: "${targetConn.username}",
  password: "${targetConn.password}",
  database: "${targetConn.database}",
};

const TABLES_TO_MIGRATE = ${JSON.stringify(selectedTables)};

const TABLE_SCHEMAS = ${JSON.stringify(TABLE_SCHEMAS, null, 2)};

// --- UTILS ---

async function getSupabaseData(supabase, table) {
  console.log(\`Fetching data for \${table}...\`);
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return data;
}

function generateCreateTableSQL(type, table, schemaBody) {
  // Dialect specific adjustments could go here
  let body = schemaBody;
  if (type === 'mssql') {
    body = body.replace(/BOOLEAN/g, 'BIT');
    body = body.replace(/DATETIME/g, 'DATETIME2');
    // TEXT is valid in MSSQL but VARCHAR(MAX) is preferred usually
    // body = body.replace(/TEXT/g, 'VARCHAR(MAX)'); 
  } else if (type === 'postgres') {
    // start with generic
  } else if (type === 'mysql') {
     // start with generic
  }
  return \`CREATE TABLE IF NOT EXISTS \${table} (\${body});\`;
}

async function runMigration() {
  console.log("Starting Migration...");
  console.log(\`Source: Supabase (\${SUPABASE_URL})\`);
  console.log(\`Target: \${TARGET_DB_TYPE} @ \${TARGET_CONFIG.host}\`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  let targetConn;
  
  try {
    // --- CONNECT TO TARGET ---
    if (TARGET_DB_TYPE === 'mssql') {
      await sql.connect({
        server: TARGET_CONFIG.host,
        port: TARGET_CONFIG.port,
        user: TARGET_CONFIG.user,
        password: TARGET_CONFIG.password,
        database: TARGET_CONFIG.database,
        options: {
          encrypt: true,
          trustServerCertificate: true
        }
      });
      targetConn = new sql.Request(); 
    } else if (TARGET_DB_TYPE === 'mysql') {
      targetConn = await mysql.createConnection({
        host: TARGET_CONFIG.host,
        port: TARGET_CONFIG.port,
        user: TARGET_CONFIG.user,
        password: TARGET_CONFIG.password,
        database: TARGET_CONFIG.database
      });
    } else if (TARGET_DB_TYPE === 'postgres') {
      targetConn = new Client({
        host: TARGET_CONFIG.host,
        port: TARGET_CONFIG.port,
        user: TARGET_CONFIG.user,
        password: TARGET_CONFIG.password,
        database: TARGET_CONFIG.database,
      });
      await targetConn.connect();
    } else {
      throw new Error(\`Unsupported DB type: \${TARGET_DB_TYPE}\`);
    }

    console.log("Connected to Target DB.");

    // --- PROCESS TABLES ---
    for (const table of TABLES_TO_MIGRATE) {
      console.log(\`\\n--- Processing table: \${table} ---\`);
      
      // 1. Fetch Data
      const rows = await getSupabaseData(supabase, table);
      console.log(\`Fetched \${rows.length} rows.\`);

      if (rows.length === 0) continue;

      // 2. Create Table
      const schema = TABLE_SCHEMAS[table];
      const createSql = generateCreateTableSQL(TARGET_DB_TYPE, table, schema);
      
      console.log("Ensuring table exists...");
      if (TARGET_DB_TYPE === 'mssql') {
        // MSSQL doesn't support IF NOT EXISTS in CREATE TABLE directly in older versions conveniently without wrapper
        // But let's verify if table exists first
        const checkTable = \`IF OBJECT_ID('dbo.\${table}', 'U') IS NULL BEGIN \${createSql.replace('IF NOT EXISTS ' + table, table)} END\`;
        await targetConn.query(checkTable);
      } else if (TARGET_DB_TYPE === 'mysql') {
        await targetConn.execute(createSql);
      } else if (TARGET_DB_TYPE === 'postgres') {
        await targetConn.query(createSql);
      }

      // 3. Insert Data
      console.log("Inserting data...");
      // Batch insert logic is better, but row-by-row for simplicity/safety implies less memory usage validation needed
      let successCount = 0;
      
      for (const row of rows) {
        // Construct INSERT statement dynamically
        const keys = Object.keys(row);
        const values = Object.values(row).map(v => {
          if (v === null) return 'NULL';
          if (typeof v === 'string') return \`'\${v.replace(/'/g, "''")}'\`; // Escape single quotes
          if (typeof v === 'object' && v instanceof Date) return \`'\${v.toISOString()}'\`; // Should catch dates if parsed
          if (typeof v === 'boolean') return v ? 1 : 0;
          return v;
        });

        const insertSql = \`INSERT INTO \${table} (\${keys.join(',')}) VALUES (\${values.join(',')})\`;

        try {
          if (TARGET_DB_TYPE === 'mssql') {
            await targetConn.query(insertSql);
          } else if (TARGET_DB_TYPE === 'mysql') {
            await targetConn.execute(insertSql);
          } else if (TARGET_DB_TYPE === 'postgres') {
             // Postgres params are $1, $2 etc. Complex to generate dynamic query string with driver params. 
             // Using literal string construction (careful with SQL injection, but this is an admin tool)
             await targetConn.query(insertSql);
          }
          successCount++;
        } catch (err) {
            // Ignore Duplicate Key errors if re-running
            if (err.message && (err.message.includes('Violation of PRIMARY KEY') || err.message.includes('Duplicate entry'))) {
                // skip
            } else {
                console.error(\`Error inserting row ID \${row.id || '?'}: \`, err.message);
            }
        }
      }
      console.log(\`Inserted \${successCount} rows.\`);
    }

  } catch (err) {
    console.error("Migration Failed:", err);
  } finally {
     if (targetConn && TARGET_DB_TYPE === 'mysql') await targetConn.end();
     if (targetConn && TARGET_DB_TYPE === 'postgres') await targetConn.end();
     if (TARGET_DB_TYPE === 'mssql') await sql.close();
  }
}

runMigration();
`;
        return script;
    };

    const handleDownload = () => {
        const script = generateMigrationScript();
        if (!script) return;

        const blob = new Blob([script], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "migrate_supabase.js";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Migratie script gedownload");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Supabase naar Externe DB Migratie</h3>
                    <p className="text-sm text-muted-foreground">Exporteer data van Supabase naar SQL Server, MySQL of PostgreSQL.</p>
                </div>
                <Button onClick={handleDownload} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download Script
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Source Config */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5 text-green-500" />
                            Bron: Supabase
                        </CardTitle>
                        <CardDescription>Configureer de bron database</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Supabase URL</Label>
                            <Input value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Supabase Key (Service Role)</Label>
                            <div className="relative">
                                <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={supabaseKey}
                                    onChange={(e) => setSupabaseKey(e.target.value)}
                                    className="pl-9"
                                    type="password"
                                    placeholder="ey..."
                                />
                            </div>
                        </div>
                        <Alert variant="destructive">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle>Belangrijk</AlertTitle>
                            <AlertDescription>
                                Gebruik de <strong>SERVICE_ROLE</strong> key om toegang tot alle data te garanderen zonder RLS beperkingen.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                {/* Target Config */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                            Doel: Externe Database
                        </CardTitle>
                        <CardDescription>Selecteer de bestemming</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Selecteer Connectie</Label>
                            <Select value={targetConnectionId} onValueChange={setTargetConnectionId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Kies een database..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {connections.length > 0 ? (
                                        connections.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-2 text-sm text-muted-foreground">Geen connecties gevonden. Voeg er eerst een toe bij "Externe Databases".</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        {targetConnectionId && (
                            <div className="text-sm text-muted-foreground border p-3 rounded bg-muted/20">
                                {(() => {
                                    const c = connections.find(x => x.id === targetConnectionId);
                                    return c ? (
                                        <div className="space-y-1">
                                            <p><strong>Host:</strong> {c.host}</p>
                                            <p><strong>Database:</strong> {c.database}</p>
                                            <p><strong>User:</strong> {c.username}</p>
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Table Selection */}
            <Card>
                <CardHeader>
                    <CardTitle>Tabellen Selecteren</CardTitle>
                    <CardDescription>Welke data wilt u migreren?</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-2 mb-4">
                        <Checkbox
                            id="select-all"
                            checked={selectedTables.length === AVAILABLE_TABLES.length}
                            onCheckedChange={handleSelectAll}
                        />
                        <Label htmlFor="select-all" className="font-bold">Alles Selecteren</Label>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {AVAILABLE_TABLES.map(table => (
                            <div key={table} className="flex items-center space-x-2">
                                <Checkbox
                                    id={table}
                                    checked={selectedTables.includes(table)}
                                    onCheckedChange={() => handleToggleTable(table)}
                                />
                                <Label htmlFor={table}>{table}</Label>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
