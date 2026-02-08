import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 999;

// MySQL CREATE TABLE definitions (same as sync-mysql-schema)
const TABLE_SQLS: Record<string, string> = {
  app_settings: `CREATE TABLE IF NOT EXISTS \`app_settings\` (
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`key\` VARCHAR(255) NOT NULL,
  \`value\` TEXT,
  \`description\` TEXT,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  gas_type_categories: `CREATE TABLE IF NOT EXISTS \`gas_type_categories\` (
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`sort_order\` INT NOT NULL DEFAULT 0,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  cylinder_sizes: `CREATE TABLE IF NOT EXISTS \`cylinder_sizes\` (
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`capacity_liters\` DECIMAL(10,2),
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`sort_order\` INT NOT NULL DEFAULT 0,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  dry_ice_packaging: `CREATE TABLE IF NOT EXISTS \`dry_ice_packaging\` (
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`capacity_kg\` DECIMAL(10,2),
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`sort_order\` INT NOT NULL DEFAULT 0,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  dry_ice_product_types: `CREATE TABLE IF NOT EXISTS \`dry_ice_product_types\` (
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`sort_order\` INT NOT NULL DEFAULT 0,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  task_types: `CREATE TABLE IF NOT EXISTS \`task_types\` (
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`color\` VARCHAR(20) NOT NULL DEFAULT '#06b6d4',
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`sort_order\` INT NOT NULL DEFAULT 0,
  \`parent_id\` CHAR(36),
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (\`parent_id\`) REFERENCES \`task_types\`(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  time_off_types: `CREATE TABLE IF NOT EXISTS \`time_off_types\` (
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`color\` VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  gas_types: `CREATE TABLE IF NOT EXISTS \`gas_types\` (
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`color\` VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`sort_order\` INT NOT NULL DEFAULT 0,
  \`category_id\` CHAR(36),
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (\`category_id\`) REFERENCES \`gas_type_categories\`(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  customers: `CREATE TABLE IF NOT EXISTS \`customers\` (
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(255) NOT NULL,
  \`contact_person\` VARCHAR(255),
  \`email\` VARCHAR(255),
  \`phone\` VARCHAR(100),
  \`address\` TEXT,
  \`notes\` TEXT,
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  gas_cylinder_orders: `CREATE TABLE IF NOT EXISTS \`gas_cylinder_orders\` (
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`order_number\` VARCHAR(100) NOT NULL,
  \`customer_name\` VARCHAR(255) NOT NULL,
  \`customer_id\` CHAR(36),
  \`gas_type\` VARCHAR(50) NOT NULL DEFAULT 'co2',
  \`gas_type_id\` CHAR(36),
  \`gas_grade\` VARCHAR(50) NOT NULL DEFAULT 'technical',
  \`cylinder_size\` VARCHAR(100) NOT NULL DEFAULT 'medium',
  \`cylinder_count\` INT NOT NULL,
  \`pressure\` INT NOT NULL DEFAULT 200,
  \`status\` VARCHAR(50) NOT NULL DEFAULT 'pending',
  \`location\` VARCHAR(50) NOT NULL DEFAULT 'sol_emmen',
  \`scheduled_date\` DATE NOT NULL,
  \`notes\` TEXT,
  \`created_by\` CHAR(36),
  \`assigned_to\` CHAR(36),
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`),
  FOREIGN KEY (\`gas_type_id\`) REFERENCES \`gas_types\`(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  dry_ice_orders: `CREATE TABLE IF NOT EXISTS \`dry_ice_orders\` (
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`order_number\` VARCHAR(100) NOT NULL,
  \`customer_name\` VARCHAR(255) NOT NULL,
  \`customer_id\` CHAR(36),
  \`product_type\` VARCHAR(50) NOT NULL DEFAULT 'blocks',
  \`product_type_id\` CHAR(36),
  \`packaging_id\` CHAR(36),
  \`quantity_kg\` DECIMAL(10,2) NOT NULL,
  \`box_count\` INT,
  \`container_has_wheels\` TINYINT(1),
  \`status\` VARCHAR(50) NOT NULL DEFAULT 'pending',
  \`location\` VARCHAR(50) NOT NULL DEFAULT 'sol_emmen',
  \`scheduled_date\` DATE NOT NULL,
  \`is_recurring\` TINYINT(1) DEFAULT 0,
  \`parent_order_id\` CHAR(36),
  \`recurrence_end_date\` DATE,
  \`notes\` TEXT,
  \`created_by\` CHAR(36),
  \`assigned_to\` CHAR(36),
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`),
  FOREIGN KEY (\`product_type_id\`) REFERENCES \`dry_ice_product_types\`(\`id\`),
  FOREIGN KEY (\`packaging_id\`) REFERENCES \`dry_ice_packaging\`(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
};

// Order matters for foreign keys
const TABLE_ORDER = [
  "app_settings",
  "gas_type_categories",
  "cylinder_sizes",
  "dry_ice_packaging",
  "dry_ice_product_types",
  "task_types",
  "time_off_types",
  "gas_types",
  "customers",
  "gas_cylinder_orders",
  "dry_ice_orders",
];

function escapeValue(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "1" : "0";
  const str = String(val)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x00/g, "\\0")
    .replace(/\x1a/g, "\\Z");
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

    const { tables } = await req.json();
    const selectedTables = (tables && tables.length > 0)
      ? TABLE_ORDER.filter((t) => tables.includes(t))
      : TABLE_ORDER;

    const lines: string[] = [];
    lines.push("-- MySQL dump generated by Lovable Cloud");
    lines.push(`-- Date: ${new Date().toISOString()}`);
    lines.push("-- --------------------------------------------------------");
    lines.push("");
    lines.push("SET NAMES utf8mb4;");
    lines.push("SET FOREIGN_KEY_CHECKS = 0;");
    lines.push("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';");
    lines.push("");

    let totalRows = 0;

    for (const tableName of selectedTables) {
      // CREATE TABLE
      const createSql = TABLE_SQLS[tableName];
      if (createSql) {
        lines.push(`-- Table: ${tableName}`);
        lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
        // Replace IF NOT EXISTS with regular CREATE since we drop first
        lines.push(createSql.replace("IF NOT EXISTS ", "") + "\n");
      }

      // Fetch all rows in batches
      let offset = 0;
      let allRows: Record<string, any>[] = [];

      while (true) {
        const { data: rows, error: fetchErr } = await supabase
          .from(tableName)
          .select("*")
          .range(offset, offset + BATCH_SIZE - 1);

        if (fetchErr) {
          lines.push(`-- ERROR fetching ${tableName}: ${fetchErr.message}`);
          break;
        }

        if (!rows || rows.length === 0) break;
        allRows = allRows.concat(rows);
        offset += rows.length;
        if (rows.length < BATCH_SIZE) break;
      }

      if (allRows.length > 0) {
        totalRows += allRows.length;
        const columns = Object.keys(allRows[0]);
        const columnList = columns.map(escapeColumnName).join(", ");

        // Batch inserts in groups of 100 rows for performance
        for (let i = 0; i < allRows.length; i += 100) {
          const batch = allRows.slice(i, i + 100);
          const valueRows = batch.map((row) => {
            const vals = columns.map((c) => escapeValue(row[c]));
            return `(${vals.join(", ")})`;
          });

          lines.push(
            `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n${valueRows.join(",\n")};`
          );
        }
        lines.push(`-- ${allRows.length} rows exported for ${tableName}`);
      } else {
        lines.push(`-- 0 rows in ${tableName}`);
      }
      lines.push("");
    }

    lines.push("SET FOREIGN_KEY_CHECKS = 1;");
    lines.push("");
    lines.push(`-- Export complete: ${totalRows} total rows`);

    const sqlContent = lines.join("\n");

    // Compress with gzip
    const encoder = new TextEncoder();
    const rawBytes = encoder.encode(sqlContent);

    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(rawBytes);
    writer.close();

    const compressedChunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      compressedChunks.push(value);
    }

    let totalLen = 0;
    for (const chunk of compressedChunks) totalLen += chunk.length;
    const compressed = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of compressedChunks) {
      compressed.set(chunk, pos);
      pos += chunk.length;
    }

    const filename = `mysql_dump_${new Date().toISOString().slice(0, 10)}.sql.gz`;

    return new Response(compressed, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(compressed.length),
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
