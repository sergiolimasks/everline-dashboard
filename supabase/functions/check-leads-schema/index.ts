import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
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
    // Try with schema prefix
    const sample1 = await client.queryObject(`SELECT * FROM bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac LIMIT 3`);
    const sample2 = await client.queryObject(`SELECT * FROM bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter LIMIT 3`);
    return new Response(JSON.stringify({ 
      aplicacao_formac: { columns: Object.keys(sample1.rows[0] || {}), sample: sample1.rows },
      acao_50k_ter: { columns: Object.keys(sample2.rows[0] || {}), sample: sample2.rows }
    }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } finally {
    await client.end();
  }
});
