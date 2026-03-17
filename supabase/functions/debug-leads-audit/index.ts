import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function queryExternalPG(sql: string, params: unknown[] = []) {
  const client = new Client({
    hostname: "72.60.51.200",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "REDACTED_PG_PASS",
    tls: { enabled: false },
  });
  await client.connect();
  try {
    const result = await client.queryObject(sql, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const day = searchParams.get("day") || "2026-03-17";

    const [types, aplicacao, lancamento] = await Promise.all([
      queryExternalPG(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'bd_ads_clientes'
          AND table_name IN ('leads_uelicon_venancio_aplicacao_formac', 'leads_uelicon_venancio_acao_50k_ter')
          AND column_name = 'Data'
        ORDER BY table_name
      `),
      queryExternalPG(`
        SELECT
          COUNT(*) FILTER (WHERE "Data"::date = $1::date) AS utc_date_rows,
          COUNT(DISTINCT "telefone") FILTER (WHERE "Data"::date = $1::date) AS utc_date_unique_phone,
          COUNT(*) FILTER (WHERE (("Data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date = $1::date) AS sp_from_utc_rows,
          COUNT(DISTINCT "telefone") FILTER (WHERE (("Data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date = $1::date) AS sp_from_utc_unique_phone,
          MIN("Data") FILTER (WHERE (("Data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date = $1::date) AS sp_min,
          MAX("Data") FILTER (WHERE (("Data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date = $1::date) AS sp_max
        FROM bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac
      `, [day]),
      queryExternalPG(`
        SELECT
          COUNT(*) FILTER (WHERE "Data"::date = $1::date) AS utc_date_rows,
          COUNT(DISTINCT "email") FILTER (WHERE "Data"::date = $1::date) AS utc_date_unique_email,
          COUNT(*) FILTER (WHERE (("Data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date = $1::date) AS sp_from_utc_rows,
          COUNT(DISTINCT "email") FILTER (WHERE (("Data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date = $1::date) AS sp_from_utc_unique_email,
          MIN("Data") FILTER (WHERE (("Data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date = $1::date) AS sp_min,
          MAX("Data") FILTER (WHERE (("Data" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date = $1::date) AS sp_max
        FROM bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter
      `, [day]),
    ]);

    return new Response(JSON.stringify({
      day,
      data_types: types,
      aplicacao: aplicacao[0] ?? null,
      lancamento: lancamento[0] ?? null,
    }, (_, value) => typeof value === "bigint" ? Number(value) : value), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});