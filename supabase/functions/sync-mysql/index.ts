import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 500;

// Column mappings: some Postgres columns need transformation for MySQL
// Timestamps: Postgres timestamptz -> MySQL DATETIME (strip timezone)
// Booleans: Postgres bool -> MySQL TINYINT(1) (true->1, false->0)
function transformRowForMySQL(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      result[key] = null;
    } else if (typeof value === "boolean") {
      result[key] = value ? 1 : 0;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function escapeValue(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "1" : "0";
  // Escape string
  const str = String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  return `'${str}'`;
}

function escapeColumnName(name: string): string {
  return `\`${name}\``;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Alleen admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      mysqlHost, mysqlPort, mysqlUser, mysqlPassword, mysqlDatabase,
      tables, tableIndex = 0, batchOffset = 0,
      accumulatedResults = {},
      currentTableRows = 0, currentTableInserted = 0, currentTableErrors = [],
    } = await req.json();

    if (!mysqlHost || !mysqlUser || !mysqlDatabase || !tables || tables.length === 0) {
      return new Response(
        JSON.stringify({ error: "MySQL credentials en tabellen zijn vereist" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { default: mysql } = await import("https://esm.sh/mysql2@3.11.0/promise?target=deno");

    const connection = await mysql.createConnection({
      host: mysqlHost,
      port: parseInt(mysqlPort || "3306"),
      user: mysqlUser,
      password: mysqlPassword,
      database: mysqlDatabase,
    });

    const currentTable = tables[tableIndex];
    let tRows = currentTableRows;
    let tInserted = currentTableInserted;
    let tErrors = [...currentTableErrors];

    // Fetch batch from Supabase
    const { data: rows, error: fetchErr } = await supabase
      .from(currentTable)
      .select("*")
      .range(batchOffset, batchOffset + BATCH_SIZE - 1);

    if (fetchErr) {
      tErrors.push(`Fetch error: ${fetchErr.message}`);
    }

    const fetchedRows = rows || [];
    tRows += fetchedRows.length;

    // Insert into MySQL using INSERT ... ON DUPLICATE KEY UPDATE
    if (fetchedRows.length > 0) {
      for (const row of fetchedRows) {
        try {
          const transformed = transformRowForMySQL(row);
          const columns = Object.keys(transformed);
          const values = columns.map((c) => escapeValue(transformed[c]));
          const updateClause = columns
            .filter((c) => c !== "id")
            .map((c) => `${escapeColumnName(c)}=VALUES(${escapeColumnName(c)})`)
            .join(", ");

          const sql = `INSERT INTO ${escapeColumnName(currentTable)} (${columns.map(escapeColumnName).join(", ")}) VALUES (${values.join(", ")}) ON DUPLICATE KEY UPDATE ${updateClause}`;
          await connection.execute(sql);
          tInserted++;
        } catch (e) {
          tErrors.push(`Row ${row.id || "?"}: ${e.message?.substring(0, 100)}`);
        }
      }
    }

    await connection.end();

    // Check if more batches for this table
    if (fetchedRows.length === BATCH_SIZE) {
      return new Response(
        JSON.stringify({
          done: false,
          tableIndex,
          batchOffset: batchOffset + BATCH_SIZE,
          accumulatedResults,
          currentTableRows: tRows,
          currentTableInserted: tInserted,
          currentTableErrors: tErrors,
          progress: {
            table: currentTable,
            tableNum: tableIndex + 1,
            totalTables: tables.length,
            rowsProcessed: tRows,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Table done, save results
    const newAccumulated = {
      ...accumulatedResults,
      [currentTable]: { rows: tRows, inserted: tInserted, errors: tErrors },
    };

    // More tables?
    if (tableIndex + 1 < tables.length) {
      return new Response(
        JSON.stringify({
          done: false,
          tableIndex: tableIndex + 1,
          batchOffset: 0,
          accumulatedResults: newAccumulated,
          currentTableRows: 0,
          currentTableInserted: 0,
          currentTableErrors: [],
          progress: {
            table: tables[tableIndex + 1],
            tableNum: tableIndex + 2,
            totalTables: tables.length,
            rowsProcessed: 0,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All done
    let totalRows = 0, totalInserted = 0, totalErrors = 0;
    for (const detail of Object.values(newAccumulated) as any[]) {
      totalRows += detail.rows;
      totalInserted += detail.inserted;
      totalErrors += detail.errors.length;
    }

    return new Response(
      JSON.stringify({
        done: true,
        success: true,
        direction: "push_mysql",
        summary: { totalRows, totalInserted, totalErrors },
        details: newAccumulated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
