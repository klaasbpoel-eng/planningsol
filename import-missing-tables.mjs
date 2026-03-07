/**
 * import-missing-tables.mjs
 * Importeert ontbrekende tabellen naar het NIEUWE Supabase project.
 *
 * Gebruik (na backup-missing-tables.mjs):
 *   node import-missing-tables.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── CONFIGURE HERE (nieuwe project) ─────────────────────────────────────────
const NEW_URL = 'https://sbngjpnvxwwlchenyhhy.supabase.co';
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'VUL_HIER_JE_SERVICE_ROLE_KEY_IN';
const BACKUP = join(dirname(fileURLToPath(import.meta.url)), 'backup-missing-2026-03-06.json');
const BATCH_SIZE = 500;
// ─────────────────────────────────────────────────────────────────────────────

// Tabellen waarbij created_by/assigned_to GEEN FK-check nodig heeft
// (profielen bestaan niet in het nieuwe project)
const NO_FK_TABLES = new Set([
  'tasks', 'time_off_requests', 'employee_leave_balances',
  'toolbox_sessions', 'toolbox_session_participants', 'toolbox_completions',
  'ambulance_trips', 'internal_orders',
]);

// Volgorde respecteert FK-afhankelijkheden
const TABLE_ORDER = [
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

const supabase = createClient(NEW_URL, NEW_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function upsertBatch(table, rows) {
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
  if (error) {
    // PGRST205 = tabel bestaat niet in schema → overslaan
    if (error.code === 'PGRST205' || error.code === '42P01') {
      throw Object.assign(new Error(`tabel bestaat niet in nieuw schema`), { skip: true });
    }
    throw new Error(`[${table}] ${error.code}: ${error.message}`);
  }
}

async function migrateTable(table, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  ⏭  ${table}: geen data`);
    return;
  }
  const total = rows.length;
  let done = 0;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    await upsertBatch(table, rows.slice(i, i + BATCH_SIZE));
    done += Math.min(BATCH_SIZE, total - i);
    process.stdout.write(`\r  ✓  ${table}: ${done}/${total}`);
    if (done >= total) break; // eerste batch bepaalt al of tabel bestaat
  }
  console.log(`\r  ✓  ${table}: ${total} rijen gemigreerd`);
}

async function main() {
  console.log('=== Import ontbrekende tabellen → nieuw project ===\n');

  const backup = JSON.parse(readFileSync(BACKUP, 'utf-8'));
  const tables = backup.tables || {};

  let total = 0;
  for (const table of TABLE_ORDER) {
    try {
      const rows = tables[table] || [];
      total += rows.length;
      await migrateTable(table, rows);
    } catch (err) {
      if (err.skip) {
        console.log(`  ⏭  ${table}: overgeslagen (tabel bestaat niet in nieuw schema)`);
      } else {
        console.error(`\n❌ Fout bij "${table}": ${err.message}`);
        console.error('   Migratie gestopt.');
        process.exit(1);
      }
    }
  }

  console.log(`\n✅ Klaar! ${total.toLocaleString()} rijen gemigreerd naar ${NEW_URL}`);
}

main();
