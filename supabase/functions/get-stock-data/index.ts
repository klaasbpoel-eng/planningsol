import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts"

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Initialize the pool at the cold-start edge scope, not on every request!
const pool = new Pool(Deno.env.get('SUPABASE_DB_URL')!, 2) // Pool size 2 since we will fetch 2 queries in parallel

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: cors })
  }

  try {
    const client = await pool.connect()

    // Run both large table aggregations perfectly in parallel
    const [voorraad, afname] = await Promise.all([
      client.queryObject(`
        SELECT "DS_SUBCODE" as subcode, "DS_CENTER_DESCRIPTION" as center, COUNT(*)::int as count
        FROM voorraad GROUP BY "DS_SUBCODE", "DS_CENTER_DESCRIPTION"
      `),
      client.queryObject(`
        SELECT "SubCode" as subcode, "SubCodeDescription" as description,
               "CenterDescription" as center, SUM("Aantal")::float as total_aantal
        FROM afname GROUP BY "SubCode", "SubCodeDescription", "CenterDescription"
      `)
    ])

    client.release()
    // Intentionally omitting await pool.end() so the connection stays open globally for the next invocation!


    return new Response(JSON.stringify({ voorraad: voorraad.rows, afname: afname.rows }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
