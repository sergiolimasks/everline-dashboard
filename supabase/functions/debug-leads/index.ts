import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const aplicacao = await queryExternalPG(
      `SELECT COUNT(*) as total FROM bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac WHERE "Data"::date = $1`,
      ['2026-03-17']
    );
    const lancamento = await queryExternalPG(
      `SELECT COUNT(*) as total FROM bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter WHERE "Data"::date = $1`,
      ['2026-03-17']
    );
    // Also check column names
    const colsAplic = await queryExternalPG(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'bd_ads_clientes' AND table_name = 'leads_uelicon_venancio_aplicacao_formac' ORDER BY ordinal_position`
    );
    const colsLanc = await queryExternalPG(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'bd_ads_clientes' AND table_name = 'leads_uelicon_venancio_acao_50k_ter' ORDER BY ordinal_position`
    );

    return new Response(JSON.stringify({
      aplicacao_count: Number((aplicacao[0] as any)?.total || 0),
      lancamento_count: Number((lancamento[0] as any)?.total || 0),
      total: Number((aplicacao[0] as any)?.total || 0) + Number((lancamento[0] as any)?.total || 0),
      columns_aplicacao: colsAplic,
      columns_lancamento: colsLanc,
    }, (_, v) => typeof v === 'bigint' ? Number(v) : v), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
