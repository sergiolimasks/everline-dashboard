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

    const [schema, aplicacaoStats, lancamentoStats, aplicacaoRawDates, lancamentoRawDates] = await Promise.all([
      queryExternalPG(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'bd_ads_clientes'
          AND table_name IN ('leads_uelicon_venancio_aplicacao_formac', 'leads_uelicon_venancio_acao_50k_ter')
        ORDER BY table_name, ordinal_position
      `),
      queryExternalPG(`
        SELECT
          COUNT(*) FILTER (WHERE "Data"::date = $1::date) AS total_rows,
          COUNT(*) FILTER (WHERE "Data"::date = $1::date AND NULLIF(TRIM(COALESCE("telefone", '')), '') IS NOT NULL) AS with_phone,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("telefone", '')), '')) FILTER (WHERE "Data"::date = $1::date) AS unique_phone,
          COUNT(*) FILTER (WHERE "Data"::date = $1::date AND NULLIF(TRIM(COALESCE("nome", '')), '') IS NOT NULL) AS with_name
        FROM bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac
      `, [day]),
      queryExternalPG(`
        SELECT
          COUNT(*) FILTER (WHERE "Data"::date = $1::date) AS total_rows,
          COUNT(*) FILTER (WHERE "Data"::date = $1::date AND NULLIF(TRIM(COALESCE("email", '')), '') IS NOT NULL) AS with_email,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("email", '')), '')) FILTER (WHERE "Data"::date = $1::date) AS unique_email,
          COUNT(*) FILTER (WHERE "Data"::date = $1::date AND NULLIF(TRIM(COALESCE("telefone", '')), '') IS NOT NULL) AS with_phone,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("telefone", '')), '')) FILTER (WHERE "Data"::date = $1::date) AS unique_phone
        FROM bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter
      `, [day]),
      queryExternalPG(`
        SELECT "Data", COUNT(*) AS total
        FROM bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac
        WHERE "Data"::date BETWEEN ($1::date - INTERVAL '1 day') AND ($1::date + INTERVAL '1 day')
        GROUP BY "Data"
        ORDER BY "Data"
      `, [day]),
      queryExternalPG(`
        SELECT "Data", COUNT(*) AS total
        FROM bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter
        WHERE "Data"::date BETWEEN ($1::date - INTERVAL '1 day') AND ($1::date + INTERVAL '1 day')
        GROUP BY "Data"
        ORDER BY "Data"
      `, [day]),
    ]);

    return new Response(JSON.stringify({
      day,
      schema,
      aplicacao: aplicacaoStats[0] ?? null,
      lancamento: lancamentoStats[0] ?? null,
      aplicacao_raw_dates: aplicacaoRawDates,
      lancamento_raw_dates: lancamentoRawDates,
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