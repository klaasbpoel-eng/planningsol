import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TABLE_SQLS: { name: string; sql: string }[] = [
  {
    name: "app_settings",
    sql: `CREATE TABLE IF NOT EXISTS app_settings (
      id CHAR(36) NOT NULL PRIMARY KEY,
      \`key\` VARCHAR(255) NOT NULL,
      value TEXT,
      description TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "gas_type_categories",
    sql: `CREATE TABLE IF NOT EXISTS gas_type_categories (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "cylinder_sizes",
    sql: `CREATE TABLE IF NOT EXISTS cylinder_sizes (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      capacity_liters DECIMAL(10,2),
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "dry_ice_packaging",
    sql: `CREATE TABLE IF NOT EXISTS dry_ice_packaging (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      capacity_kg DECIMAL(10,2),
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "dry_ice_product_types",
    sql: `CREATE TABLE IF NOT EXISTS dry_ice_product_types (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "task_types",
    sql: `CREATE TABLE IF NOT EXISTS task_types (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      color VARCHAR(20) NOT NULL DEFAULT '#06b6d4',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      parent_id CHAR(36),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES task_types(id)
    )`,
  },
  {
    name: "time_off_types",
    sql: `CREATE TABLE IF NOT EXISTS time_off_types (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "gas_types",
    sql: `CREATE TABLE IF NOT EXISTS gas_types (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      category_id CHAR(36),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES gas_type_categories(id)
    )`,
  },
  {
    name: "customers",
    sql: `CREATE TABLE IF NOT EXISTS customers (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(100),
      address TEXT,
      notes TEXT,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "gas_cylinder_orders",
    sql: `CREATE TABLE IF NOT EXISTS gas_cylinder_orders (
      id CHAR(36) NOT NULL PRIMARY KEY,
      order_number VARCHAR(100) NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_id CHAR(36),
      gas_type VARCHAR(50) NOT NULL DEFAULT 'co2',
      gas_type_id CHAR(36),
      gas_grade VARCHAR(50) NOT NULL DEFAULT 'technical',
      cylinder_size VARCHAR(100) NOT NULL DEFAULT 'medium',
      cylinder_count INT NOT NULL,
      pressure INT NOT NULL DEFAULT 200,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      location VARCHAR(50) NOT NULL DEFAULT 'sol_emmen',
      scheduled_date DATE NOT NULL,
      notes TEXT,
      created_by CHAR(36),
      assigned_to CHAR(36),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (gas_type_id) REFERENCES gas_types(id)
    )`,
  },
  {
    name: "dry_ice_orders",
    sql: `CREATE TABLE IF NOT EXISTS dry_ice_orders (
      id CHAR(36) NOT NULL PRIMARY KEY,
      order_number VARCHAR(100) NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_id CHAR(36),
      product_type VARCHAR(50) NOT NULL DEFAULT 'blocks',
      product_type_id CHAR(36),
      packaging_id CHAR(36),
      quantity_kg DECIMAL(10,2) NOT NULL,
      box_count INT,
      container_has_wheels TINYINT(1),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      location VARCHAR(50) NOT NULL DEFAULT 'sol_emmen',
      scheduled_date DATE NOT NULL,
      is_recurring TINYINT(1) DEFAULT 0,
      parent_order_id CHAR(36),
      recurrence_end_date DATE,
      notes TEXT,
      created_by CHAR(36),
      assigned_to CHAR(36),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (product_type_id) REFERENCES dry_ice_product_types(id),
      FOREIGN KEY (packaging_id) REFERENCES dry_ice_packaging(id)
    )`,
  },
];

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

    const { mysqlHost, mysqlPort, mysqlUser, mysqlPassword, mysqlDatabase, tables } = await req.json();

    if (!mysqlHost || !mysqlUser || !mysqlDatabase) {
      return new Response(
        JSON.stringify({ error: "MySQL host, user en database zijn vereist" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = await new Client().connect({
      hostname: mysqlHost,
      port: parseInt(mysqlPort || "3306"),
      username: mysqlUser,
      password: mysqlPassword,
      db: mysqlDatabase,
    });

    const results: { name: string; status: "created" | "error"; error?: string }[] = [];

    const selectedTables = tables && tables.length > 0
      ? TABLE_SQLS.filter((t) => tables.includes(t.name))
      : TABLE_SQLS;

    for (const table of selectedTables) {
      try {
        await client.execute(table.sql);
        results.push({ name: table.name, status: "created" });
      } catch (e) {
        results.push({ name: table.name, status: "error", error: e.message });
      }
    }

    await client.close();

    const errors = results.filter((r) => r.status === "error");

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        results,
        summary: { total: results.length, created: results.filter((r) => r.status === "created").length, errors: errors.length },
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
