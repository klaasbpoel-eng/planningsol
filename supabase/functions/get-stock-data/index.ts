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

    const [voorraad, afname] = await Promise.all([
      client.queryObject(`
        SELECT "CD_SUBCODE" as subcode, "DS_SUBCODE" as description,
               "DS_CENTER_DESCRIPTION" as center, SUM("Aantal")::float as aantal
        FROM public."Voorraad"
        GROUP BY "CD_SUBCODE", "DS_SUBCODE", "DS_CENTER_DESCRIPTION"
      `),
      client.queryObject(`
        SELECT "SubCode" as subcode, "SubCodeDescription" as description,
               "CenterDescription" as center, SUM("Aantal")::float as aantal
        FROM public."Afname"
        GROUP BY "SubCode", "SubCodeDescription", "CenterDescription"
      `)
    ])

    client.release()
    await pool.end()

    return new Response(JSON.stringify({ voorraad: voorraad.rows, afname: afname.rows }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
