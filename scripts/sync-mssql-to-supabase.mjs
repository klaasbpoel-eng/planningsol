/**
 * sync-mssql-to-supabase.mjs
 * 
 * Dynamische data-sync van lokale MS SQL Server naar Supabase.
 * Dit script leest configuratie-taken uit de Supabase tabel 'sql_sync_tasks',
 * voert de query uit op de SQL Server, en pusht de resultaten naar de opgegeven doeltabel in Supabase.
 * 
 * Gebruik: node scripts/sync-mssql-to-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

// ─── SQL Server Configuratie (Lokaal) ───────────────────────────────────────
const sqlConfig = {
    user: process.env.SQL_USER || 'sa',             // Vul in of gebruik .env
    password: process.env.SQL_PASSWORD || 'Secret123!', // Vul in of gebruik .env
    database: process.env.SQL_DATABASE || 'MijnDatabase', // Vul in of gebruik .env
    server: process.env.SQL_SERVER || 'localhost',  // Bijv. 'localhost' of '192.168.1.100'
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false, // Zet op true in productie als je een certificaat hebt
        trustServerCertificate: true // OK voor lokaal
    }
};

// ─── Supabase Configuratie (Cloud) ──────────────────────────────────────────
// LET OP: Gebruik de service_role key als we RLS (Row Level Security) willen omzeilen
// of in afgeschermde backend-tabellen schrijven.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://sbngjpnvxwwlchenyhhy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'VUL_HIER_JE_SERVICE_ROLE_KEY_IN';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
    console.log('🔄 Data Sync Engine gestart...');

    try {
        // 1. Haal alle actieve taken op uit Supabase
        const { data: tasks, error: tasksError } = await supabase
            .from('sql_sync_tasks')
            .select('*')
            .eq('is_active', true);

        if (tasksError) {
            throw new Error(`Cloud configuratie niet kunnen ophalen: ${tasksError.message}`);
        }

        if (!tasks || tasks.length === 0) {
            console.log('ℹ️ Geen actieve sync-taken gevonden.');
            return;
        }

        console.log(`📋 ${tasks.length} actieve ta(a)k(en) gevonden.`);

        // 2. Verbind met lokale SQL Server
        console.log(`🔌 Verbinden met bron SQL Server op ${sqlConfig.server}...`);
        let pool = await sql.connect(sqlConfig);
        console.log(`✓ Verbonden met SQL database: ${sqlConfig.database}`);

        // 3. Verwerk elke taak één voor één
        for (const task of tasks) {
            console.log(`\n▶️ Start taak: "${task.name}"`);

            try {
                // 3.A Query de SQL Server
                const result = await pool.request().query(task.source_query);
                const rows = result.recordset;

                console.log(`  ← Resultaat ophalen: ${rows.length} rijen gevonden via query`);

                if (rows.length === 0) {
                    console.log(`  ⏭  Geen data om te synchroniseren voor ${task.name}`);
                    continue; // Ga door naar de volgende taak
                }

                // 3.B Push naar Supabase (Upsert met gedefinieerde primary key)
                console.log(`  → Data versturen naar Supabase tabel: ${task.destination_table}...`);
                const { error: upsertError } = await supabase
                    .from(task.destination_table)
                    .upsert(rows, {
                        onConflict: task.primary_key_column,
                        ignoreDuplicates: false // We willen altijd updaten als data veranderd is
                    });

                if (upsertError) {
                    console.error(`  ❌ Fout bij wegschrijven naar ${task.destination_table}: ${upsertError.message}`);
                    // Omdat we in een for-loop zitten, breekt deze specifieke taak af, maar proberen we wel de volgende.
                    continue;
                }

                console.log(`  ✓ Succesvol gerepliceerd!`);

                // 3.C Update 'last_sync_time' in Supabase voor deze taak
                await supabase
                    .from('sql_sync_tasks')
                    .update({ last_sync_time: new Date().toISOString() })
                    .eq('id', task.id);

            } catch (err) {
                console.error(`  ❌ Fout tijdens het uitvoeren van taak '${task.name}':`, err.message);
            }
        } // Einde For loop

    } catch (err) {
        console.error('❌ Fatale fout in sync master:', err);
    } finally {
        sql.close(); // Zorg dat de connectie netjes afsluit
        console.log('\n✅ Sync Engine klaar en afgesloten.');
    }
}

// Start de magie
main();
