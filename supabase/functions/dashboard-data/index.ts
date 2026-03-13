// Dashboard data edge function v4
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint') || 'summary';
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    let dateFilter = '';
    const params: string[] = [];

    if (dateFrom && dateTo) {
      dateFilter = ` AND data::date >= $1 AND data::date <= $2`;
      params.push(dateFrom, dateTo);
    }

    let data: unknown[] = [];

    if (endpoint === 'traffic_daily') {
      data = await queryExternalPG(`
        SELECT 
          data::date as dia,
          SUM(impressoes) as impressoes,
          SUM(alcance) as alcance,
          SUM(cliques) as cliques,
          SUM(cliques_link) as cliques_link,
          SUM(views_pagina) as views_pagina,
          SUM(checkouts) as checkouts,
          SUM(compras) as compras,
          SUM(valor_compras) as valor_compras,
          SUM(gasto) as gasto
        FROM bd_ads_clientes.meta_uelicon_venancio
        WHERE 1=1 ${dateFilter}
        GROUP BY data::date
        ORDER BY data::date DESC
      `, params);
    } else if (endpoint === 'sales_daily') {
      const salesDateFilter = dateFrom && dateTo
        ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
        : '';
      data = await queryExternalPG(`
        SELECT 
          "Data"::date as dia,
          "Nome do produto" as produto,
          COUNT(*) FILTER (WHERE "Status da venda" IN ('Aprovada','aprovada','approved','Completa','completa')) as vendas_aprovadas,
          COUNT(*) as total_vendas,
          SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved','Completa','completa') THEN "Valor Bruto"::numeric ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved','Completa','completa') THEN "Valor Líquido"::numeric ELSE 0 END) as receita_liquida,
          SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved','Completa','completa') THEN "TAXA GREEN"::numeric ELSE 0 END) as taxa_total
        FROM uelicon_database.controle_green
        WHERE 1=1 ${salesDateFilter}
        GROUP BY "Data"::date, "Nome do produto"
        ORDER BY "Data"::date DESC
      `, params);
    } else if (endpoint === 'summary') {
      const traffic = await queryExternalPG(`
        SELECT 
          SUM(impressoes) as total_impressoes,
          SUM(cliques) as total_cliques,
          SUM(cliques_link) as total_cliques_link,
          SUM(views_pagina) as total_views,
          SUM(checkouts) as total_checkouts,
          SUM(compras) as total_compras_meta,
          SUM(valor_compras) as total_valor_compras,
          SUM(gasto) as total_gasto,
          COUNT(DISTINCT data::date) as dias_ativos
        FROM bd_ads_clientes.meta_uelicon_venancio
        WHERE 1=1 ${dateFilter}
      `, params);

      const salesDateFilter = dateFrom && dateTo
        ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
        : '';
      const sales = await queryExternalPG(`
        SELECT 
          COUNT(*) FILTER (WHERE "Status da venda" IN ('Aprovada','aprovada','approved','Completa','completa')) as vendas_aprovadas,
          COUNT(*) as total_vendas,
          SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved','Completa','completa') THEN "Valor Bruto"::numeric ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved','Completa','completa') THEN "Valor Líquido"::numeric ELSE 0 END) as receita_liquida,
          SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved','Completa','completa') THEN "TAXA GREEN"::numeric ELSE 0 END) as taxa_total
        FROM uelicon_database.controle_green
        WHERE 1=1 ${salesDateFilter}
      `, params);

      const checkoutTraffic = await queryExternalPG(`
        SELECT 
          SUM(gasto) as gasto_checkout,
          SUM(cliques) as cliques_checkout,
          SUM(impressoes) as impressoes_checkout,
          SUM(checkouts) as checkouts_checkout,
          SUM(compras) as compras_checkout
        FROM bd_ads_clientes.meta_uelicon_venancio
        WHERE UPPER(campanha) LIKE '%CHECKOUT%' ${dateFilter}
      `, params);

      const products = await queryExternalPG(`
        SELECT 
          "Nome do produto" as produto,
          COUNT(*) FILTER (WHERE "Status da venda" IN ('Aprovada','aprovada','approved','Completa','completa')) as vendas_aprovadas,
          SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved','Completa','completa') THEN "Valor Bruto"::numeric ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved','Completa','completa') THEN "Valor Líquido"::numeric ELSE 0 END) as receita_liquida
        FROM uelicon_database.controle_green
        WHERE 1=1 ${salesDateFilter}
        GROUP BY "Nome do produto"
      `, params);

      data = [{
        traffic: traffic[0],
        sales: sales[0],
        checkout_traffic: checkoutTraffic[0],
        products,
      }];
    } else if (endpoint === 'campaigns') {
      data = await queryExternalPG(`
        SELECT 
          campanha,
          SUM(impressoes) as impressoes,
          SUM(alcance) as alcance,
          SUM(cliques) as cliques,
          SUM(cliques_link) as cliques_link,
          SUM(views_pagina) as views_pagina,
          SUM(checkouts) as checkouts,
          SUM(compras) as compras,
          SUM(valor_compras) as valor_compras,
          SUM(gasto) as gasto,
          CASE WHEN SUM(cliques) > 0 THEN SUM(gasto) / SUM(cliques) ELSE 0 END as cpc,
          CASE WHEN SUM(impressoes) > 0 THEN (SUM(gasto) / SUM(impressoes)) * 1000 ELSE 0 END as cpm
        FROM bd_ads_clientes.meta_uelicon_venancio
        WHERE 1=1 ${dateFilter}
        GROUP BY campanha
        ORDER BY SUM(gasto) DESC
      `, params);
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Dashboard v4 error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
