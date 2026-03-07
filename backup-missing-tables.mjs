/**
 * backup-missing-tables.mjs
 * Exporteert ontbrekende tabellen uit het OUDE Supabase project.
 *
 * Gebruik:
 *   node backup-missing-tables.mjs
 *
 * Vul je credentials voor het OUDE project in bij CONFIGURE HERE.
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── CONFIGURE HERE (oude project) ───────────────────────────────────────────
const OLD_URL = 'https://lrgjeqsvgsxarneegzmd.supabase.co';
const OLD_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZ2plcXN2Z3N4YXJuZWVnem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMDgyODgsImV4cCI6MjA4NDc4NDI4OH0.KcAhdD4r15tX4FQ5ZKAdNs7-M0MTyXmH9TRpn8rQmFI';
const EMAIL = 'kbpoel@solnederland.nl';   // ← vul je admin e-mailadres in
const PASSWORD = 'Iselin13112010!';   // ← vul je admin wachtwoord in
const OUT_FILE = join(dirname(fileURLToPath(import.meta.url)), 'backup-missing-2026-03-06.json');
// ─────────────────────────────────────────────────────────────────────────────

// Tabellen die al in de originele backup zitten — NIET opnieuw exporteren
const ALREADY_BACKED_UP = new Set([
  'gas_type_categories', 'gas_types', 'cylinder_sizes',
  'dry_ice_packaging', 'dry_ice_product_types', 'task_types',
  'time_off_types', 'app_settings', 'customers',
  'gas_cylinder_orders', 'dry_ice_orders',
]);

// Ontbrekende tabellen in volgorde van FK-afhankelijkheden
const MISSING_TABLES = [
  'products',
  'stock_products',
  'gas_mixture_recipes',
  'customer_locations',
  'customer_products',
  'orders',
  'order_items',
  'internal_orders',
  'internal_order_items',
  'ambulance_trips',
  'ambulance_trip_customers',
  'toolboxes',
  'toolbox_sections',
  'toolbox_sessions',
  'toolbox_session_participants',
  'toolbox_completions',
  'tasks',
  'time_off_requests',
  'employee_leave_balances',
];

async function fetchAll(client, table) {
  const rows = [];
  const batch = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(offset, offset + batch - 1);
    if (error) throw new Error(`[${table}] ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < batch) break;
    offset += batch;
  }
  return rows;
}

async function main() {
  console.log('=== Backup ontbrekende tabellen (oud project) ===\n');

  if (!EMAIL || !PASSWORD) {
    console.error('❌ Vul EMAIL en PASSWORD in bij CONFIGURE HERE.');
    process.exit(1);
  }

  const supabase = createClient(OLD_URL, OLD_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Inloggen als admin
  console.log(`Inloggen als ${EMAIL}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authError || !authData.session) {
    console.error('❌ Inloggen mislukt:', authError?.message);
    process.exit(1);
  }
  console.log('✓ Ingelogd\n');

  const tables = {};
  let totalRows = 0;

  for (const table of MISSING_TABLES) {
    try {
      const rows = await fetchAll(supabase, table);
      tables[table] = rows;
      totalRows += rows.length;
      console.log(`  ✓  ${table}: ${rows.length} rijen`);
    } catch (err) {
      console.warn(`  ⚠  ${table}: ${err.message} (overgeslagen)`);
      tables[table] = [];
    }
  }

  const backup = {
    version: '1.1',
    created_at: new Date().toISOString(),
    source: OLD_URL,
    tables,
  };

  writeFileSync(OUT_FILE, JSON.stringify(backup, null, 2));
  console.log(`\n✅ Klaar! ${totalRows.toLocaleString()} rijen → ${OUT_FILE}`);
}

main();
