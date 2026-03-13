// Dashboard data edge function - connects to external PostgreSQL
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const connectionString = Deno.env.get('EXTERNAL_PG_CONNECTION_STRING');
    if (!connectionString) {
      throw new Error('EXTERNAL_PG_CONNECTION_STRING not configured');
    }

    const pool = new Pool(connectionString, 3, true);
    const connection = await pool.connect();

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

      let result;

      if (endpoint === 'traffic') {
        // Traffic data grouped by day
        result = await connection.queryObject(`
          SELECT 
            data::date as dia,
            campanha,
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
          GROUP BY data::date, campanha
          ORDER BY data::date DESC
        `, params);
      } else if (endpoint === 'traffic_daily') {
        // Traffic aggregated by day only (for charts)
        result = await connection.queryObject(`
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
      } else if (endpoint === 'sales') {
        // Sales data from Greenn
        const salesDateFilter = dateFrom && dateTo
          ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
          : '';
        result = await connection.queryObject(`
          SELECT 
            "Data"::date as dia,
            "Nome do produto" as produto,
            "Status da venda" as status,
            "Valor Bruto"::numeric as valor_bruto,
            "Valor Líquido"::numeric as valor_liquido,
            "TAXA GREEN"::numeric as taxa_green,
            "Método de pagamento" as metodo_pagamento,
            "Nome da Oferta" as nome_oferta,
            "tipo" as tipo
          FROM uelicon_database.controle_green
          WHERE 1=1 ${salesDateFilter}
          ORDER BY "Data"::date DESC
        `, params);
      } else if (endpoint === 'sales_daily') {
        // Sales aggregated by day and product
        const salesDateFilter = dateFrom && dateTo
          ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
          : '';
        result = await connection.queryObject(`
          SELECT 
            "Data"::date as dia,
            "Nome do produto" as produto,
            COUNT(*) FILTER (WHERE "Status da venda" = 'Aprovada' OR "Status da venda" = 'aprovada' OR "Status da venda" = 'approved') as vendas_aprovadas,
            COUNT(*) as total_vendas,
            SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved') THEN "Valor Bruto"::numeric ELSE 0 END) as receita_bruta,
            SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved') THEN "Valor Líquido"::numeric ELSE 0 END) as receita_liquida,
            SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved') THEN "TAXA GREEN"::numeric ELSE 0 END) as taxa_total
          FROM uelicon_database.controle_green
          WHERE 1=1 ${salesDateFilter}
          GROUP BY "Data"::date, "Nome do produto"
          ORDER BY "Data"::date DESC
        `, params);
      } else if (endpoint === 'summary') {
        // Overall summary combining both
        const trafficResult = await connection.queryObject(`
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
        const salesResult = await connection.queryObject(`
          SELECT 
            COUNT(*) FILTER (WHERE "Status da venda" IN ('Aprovada','aprovada','approved')) as vendas_aprovadas,
            COUNT(*) as total_vendas,
            SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved') THEN "Valor Bruto"::numeric ELSE 0 END) as receita_bruta,
            SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved') THEN "Valor Líquido"::numeric ELSE 0 END) as receita_liquida,
            SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved') THEN "TAXA GREEN"::numeric ELSE 0 END) as taxa_total
          FROM uelicon_database.controle_green
          WHERE 1=1 ${salesDateFilter}
        `, params);

        // Checkout campaigns traffic
        const checkoutTraffic = await connection.queryObject(`
          SELECT 
            SUM(gasto) as gasto_checkout,
            SUM(cliques) as cliques_checkout,
            SUM(impressoes) as impressoes_checkout,
            SUM(checkouts) as checkouts_checkout,
            SUM(compras) as compras_checkout
          FROM bd_ads_clientes.meta_uelicon_venancio
          WHERE UPPER(campanha) LIKE '%CHECKOUT%' ${dateFilter}
        `, params);

        // Checkup product sales
        const checkupSales = await connection.queryObject(`
          SELECT 
            "Nome do produto" as produto,
            COUNT(*) FILTER (WHERE "Status da venda" IN ('Aprovada','aprovada','approved')) as vendas_aprovadas,
            SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved') THEN "Valor Bruto"::numeric ELSE 0 END) as receita_bruta,
            SUM(CASE WHEN "Status da venda" IN ('Aprovada','aprovada','approved') THEN "Valor Líquido"::numeric ELSE 0 END) as receita_liquida
          FROM uelicon_database.controle_green
          WHERE 1=1 ${salesDateFilter}
          GROUP BY "Nome do produto"
        `, params);

        result = {
          rows: [{
            traffic: trafficResult.rows[0],
            sales: salesResult.rows[0],
            checkout_traffic: checkoutTraffic.rows[0],
            products: checkupSales.rows,
          }]
        };
      } else if (endpoint === 'campaigns') {
        // Campaign performance
        result = await connection.queryObject(`
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

      return new Response(JSON.stringify({ data: result?.rows || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } finally {
      connection.release();
      await pool.end();
    }
  } catch (error) {
    console.error('Dashboard data error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
