import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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
    const t1 = await client.queryObject(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads_uelicon_venancio_aplicacao_formac' ORDER BY ordinal_position`);
    const t2 = await client.queryObject(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads_uelicon_venancio_acao_50k_ter' ORDER BY ordinal_position`);
    const sample1 = await client.queryObject(`SELECT * FROM bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac LIMIT 3`);
    const sample2 = await client.queryObject(`SELECT * FROM bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter LIMIT 3`);
    return new Response(JSON.stringify({ 
      aplicacao_formac: { columns: t1.rows, sample: sample1.rows },
      acao_50k_ter: { columns: t2.rows, sample: sample2.rows }
    }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } finally {
    await client.end();
  }
});
