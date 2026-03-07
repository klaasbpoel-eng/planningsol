/**
 * migrate-to-supabase.mjs
 * Migrates backup-2026-03-05.json to a target Supabase project.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  STAP-VOOR-STAP HANDLEIDING                                  ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  1. Maak een nieuw project aan op https://supabase.com       ║
 * ║                                                              ║
 * ║  2. SCHEMA EERST: open het nieuwe project →                  ║
 * ║     SQL Editor → plak de inhoud van schema.sql en klik Run  ║
 * ║     (schema.sql staat naast dit bestand in Downloads/)       ║
 * ║                                                              ║
 * ║  3. Haal je credentials op: Project Settings → API          ║
 * ║     - Project URL  (https://xxxx.supabase.co)               ║
 * ║     - service_role key  (geheim — niet de anon key!)        ║
 * ║                                                              ║
 * ║  4. Vul ze in bij CONFIGURE HERE hieronder, of gebruik       ║
 * ║     omgevingsvariabelen (zie Usage hieronder)                ║
 * ║                                                              ║
 * ║  5. Voer uit: node migrate-to-supabase.mjs                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_KEY="eyJ..."
 *   node migrate-to-supabase.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

// ─── CONFIGURE HERE ──────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sbngjpnvxwwlchenyhhy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'VUL_HIER_JE_SERVICE_ROLE_KEY_IN';
const BACKUP_FILE = process.env.BACKUP_FILE || join(dirname(fileURLToPath(import.meta.url)), 'backup-2026-03-05.json');
const BATCH_SIZE = 500; // rows per insert batch
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Tables where we delete all rows first (pre-seeded by migrations, unique key != id)
const TRUNCATE_FIRST = new Set(['app_settings']);

// Insert order respects foreign key dependencies
const TABLE_ORDER = [
  'gas_type_categories',
  'gas_types',
  'cylinder_sizes',
  'dry_ice_packaging',
  'dry_ice_product_types',
  'task_types',
  'time_off_types',
  'app_settings',
  'customers',
  'gas_cylinder_orders',
  'dry_ice_orders',
];

async function upsertBatch(table, rows) {
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });

  if (error) {
    throw new Error(`[${table}] ${error.code}: ${error.message}`);
  }
}

async function migrateTable(table, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  ⏭  ${table}: geen data, overgeslagen`);
    return;
  }

  // For tables pre-seeded by migrations with unique constraints on non-id columns,
  // delete existing rows first to avoid duplicate key violations.
  if (TRUNCATE_FIRST.has(table)) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`[${table}] delete failed: ${error.message}`);
  }

  const total = rows.length;
  let inserted = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await upsertBatch(table, batch);
    inserted += batch.length;
    process.stdout.write(`\r  ✓  ${table}: ${inserted}/${total}`);
  }
  console.log(`\r  ✓  ${table}: ${total} rijen gemigreerd`);
}

async function main() {
  console.log('=== Supabase Data Migratie ===\n');

  if (SUPABASE_URL.includes('JOUW-PROJECT-ID')) {
    console.error('❌ Stel SUPABASE_URL in (of pas het script aan).');
    process.exit(1);
  }
  if (SUPABASE_KEY.includes('JOUW-SERVICE-ROLE-KEY')) {
    console.error('❌ Stel SUPABASE_SERVICE_KEY in (of pas het script aan).');
    process.exit(1);
  }

  console.log(`Doel:    ${SUPABASE_URL}`);
  console.log(`Backup:  ${BACKUP_FILE}\n`);

  const backup = JSON.parse(readFileSync(BACKUP_FILE, 'utf-8'));
  const tables = backup.tables || {};

  // Warn about tables in backup not in our order list
  const unknownTables = Object.keys(tables).filter(t => !TABLE_ORDER.includes(t));
  if (unknownTables.length > 0) {
    console.warn(`⚠️  Onbekende tabellen (worden overgeslagen): ${unknownTables.join(', ')}\n`);
  }

  let totalRows = 0;
  for (const table of TABLE_ORDER) {
    try {
      const rows = tables[table] || [];
      totalRows += rows.length;
      await migrateTable(table, rows);
    } catch (err) {
      console.error(`\n❌ Fout bij tabel "${table}": ${err.message}`);
      console.error('   Migratie gestopt. Los het probleem op en herstart.');
      process.exit(1);
    }
  }

  console.log(`\n✅ Klaar! ${totalRows.toLocaleString()} rijen gemigreerd naar ${SUPABASE_URL}`);
}

main();
