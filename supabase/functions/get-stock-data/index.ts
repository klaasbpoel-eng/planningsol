import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts"

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: cors })
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL not set' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  try {
    const pool = new Pool(dbUrl, 1)
    const client = await pool.connect()

    // Debug: list all tables in all schemas to find where voorraad lives
    const tables = await client.queryObject(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `)

    client.release()
    await pool.end()

    return new Response(JSON.stringify({ debug_tables: tables.rows }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
