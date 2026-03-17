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
    const [aplicacaoDaily, lancamentoDaily, aplicacaoMetrics, lancamentoMetrics] = await Promise.all([
      queryExternalPG(`
        SELECT
          "Data"::date AS utc_day,
          timezone('America/Sao_Paulo', "Data")::date AS sp_day,
          COUNT(*) AS rows_count,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("telefone", '')), '')) AS unique_phone,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("nome", '')), '')) AS unique_name
        FROM bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac
        WHERE "Data"::date BETWEEN '2026-03-15'::date AND '2026-03-18'::date
        GROUP BY 1,2
        ORDER BY 1,2
      `),
      queryExternalPG(`
        SELECT
          "Data"::date AS utc_day,
          timezone('America/Sao_Paulo', "Data")::date AS sp_day,
          COUNT(*) AS rows_count,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("email", '')), '')) AS unique_email,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("telefone", '')), '')) AS unique_phone,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("nome", '')), '')) AS unique_name
        FROM bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter
        WHERE "Data"::date BETWEEN '2026-03-15'::date AND '2026-03-18'::date
        GROUP BY 1,2
        ORDER BY 1,2
      `),
      queryExternalPG(`
        SELECT
          COUNT(*) AS rows_count,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("telefone", '')), '')) AS unique_phone,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("nome", '')), '')) AS unique_name,
          COUNT(DISTINCT CONCAT(COALESCE("nome", ''), '|', COALESCE("telefone", ''))) AS unique_name_phone
        FROM bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac
        WHERE "Data"::date = '2026-03-17'::date
      `),
      queryExternalPG(`
        SELECT
          COUNT(*) AS rows_count,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE("email", '')), '') IS NOT NULL) AS with_email,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("email", '')), '')) AS unique_email,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("telefone", '')), '')) AS unique_phone,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE("nome", '')), '')) AS unique_name,
          COUNT(DISTINCT CONCAT(COALESCE("nome", ''), '|', COALESCE("email", ''))) AS unique_name_email,
          COUNT(DISTINCT CONCAT(COALESCE("nome", ''), '|', COALESCE("telefone", ''))) AS unique_name_phone
        FROM bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter
        WHERE "Data"::date = '2026-03-17'::date
      `),
    ]);

    return new Response(JSON.stringify({
      aplicacaoDaily,
      lancamentoDaily,
      aplicacaoMetrics: aplicacaoMetrics[0] ?? null,
      lancamentoMetrics: lancamentoMetrics[0] ?? null,
    }, (_, value) => typeof value === 'bigint' ? Number(value) : value), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});