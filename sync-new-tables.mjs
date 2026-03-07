/**
 * sync-new-tables.mjs
 * Exporteert pgs_substances + bulk_storage_tanks uit het OUDE Lovable project
 * en importeert ze direct in het NIEUWE externe Supabase project.
 *
 * Gebruik: node sync-new-tables.mjs
 */

import { createClient } from '@supabase/supabase-js';

// ─── Oud (Lovable) ────────────────────────────────────────────────────────────
const OLD_URL = 'https://lrgjeqsvgsxarneegzmd.supabase.co';
const OLD_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZ2plcXN2Z3N4YXJuZWVnem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMDgyODgsImV4cCI6MjA4NDc4NDI4OH0.KcAhdD4r15tX4FQ5ZKAdNs7-M0MTyXmH9TRpn8rQmFI';
const EMAIL = 'kbpoel@solnederland.nl';
const PASSWORD = 'Iselin13112010!';

// ─── Nieuw (extern) ───────────────────────────────────────────────────────────
const NEW_URL = 'https://sbngjpnvxwwlchenyhhy.supabase.co';
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'VUL_HIER_JE_SERVICE_ROLE_KEY_IN';

// ─── Tabellen ─────────────────────────────────────────────────────────────────
const TABLES = ['pgs_substances', 'bulk_storage_tanks'];

async function fetchAll(client, table) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.from(table).select('*').range(offset, offset + 999);
    if (error) throw new Error(`[${table}] ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

async function main() {
  // Inloggen op oud project
  const oldClient = createClient(OLD_URL, OLD_ANON, { auth: { persistSession: false } });
  const { error: authErr } = await oldClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authErr) { console.error('❌ Inloggen mislukt:', authErr.message); process.exit(1); }
  console.log('✓ Ingelogd op oud project\n');

  const newClient = createClient(NEW_URL, NEW_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  for (const table of TABLES) {
    const rows = await fetchAll(oldClient, table);
    console.log(`  ← ${table}: ${rows.length} rijen opgehaald`);

    if (rows.length === 0) { console.log(`  ⏭  ${table}: geen data\n`); continue; }

    const { error } = await newClient.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
      console.error(`  ❌ ${table}: ${error.code} – ${error.message}`);
    } else {
      console.log(`  ✓  ${table}: ${rows.length} rijen geïmporteerd\n`);
    }
  }

  console.log('✅ Klaar!');
}

main();
