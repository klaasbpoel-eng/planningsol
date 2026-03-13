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

  try {
    const pool = new Pool(Deno.env.get('SUPABASE_DB_URL')!, 1)
    const client = await pool.connect()

    const voorraad = await client.queryObject(`
      SELECT "DS_SUBCODE" as subcode, "DS_CENTER_DESCRIPTION" as center, COUNT(*)::int as count
      FROM voorraad GROUP BY "DS_SUBCODE", "DS_CENTER_DESCRIPTION"
    `)
    const afname = await client.queryObject(`
      SELECT "SubCode" as subcode, "SubCodeDescription" as description,
             "CenterDescription" as center, SUM("Aantal")::float as total_aantal
      FROM afname GROUP BY "SubCode", "SubCodeDescription", "CenterDescription"
    `)

    client.release()
    await pool.end()

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
