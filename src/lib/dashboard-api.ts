// Dashboard API service

export interface SummaryData {
  traffic: {
    total_impressoes: number;
    total_cliques: number;
    total_cliques_link: number;
    total_views: number;
    total_checkouts: number;
    total_compras_meta: number;
    total_valor_compras: number;
    total_gasto: number;
    dias_ativos: number;
  };
  sales: {
    vendas_aprovadas: number;
    total_vendas: number;
    receita_bruta: number;
    receita_liquida: number;
    taxa_total: number;
  };
  checkout_traffic: {
    gasto_checkout: number;
    cliques_checkout: number;
    impressoes_checkout: number;
    checkouts_checkout: number;
    compras_checkout: number;
  };
  products: Array<{
    produto: string;
    vendas_aprovadas: number;
    receita_bruta: number;
    receita_liquida: number;
  }>;
}

export interface TrafficDaily {
  dia: string;
  impressoes: number;
  alcance: number;
  cliques: number;
  cliques_link: number;
  views_pagina: number;
  checkouts: number;
  compras: number;
  valor_compras: number;
  gasto: number;
}

export interface SalesDaily {
  dia: string;
  produto: string;
  vendas_aprovadas: number;
  total_vendas: number;
  receita_bruta: number;
  receita_liquida: number;
  taxa_total: number;
}

export interface CampaignData {
  campanha: string;
  impressoes: number;
  alcance: number;
  cliques: number;
  cliques_link: number;
  views_pagina: number;
  checkouts: number;
  compras: number;
  valor_compras: number;
  gasto: number;
  cpc: number;
  cpm: number;
}

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

async function fetchDashboard<T>(endpoint: string, dateFrom?: string, dateTo?: string): Promise<T[]> {
  const params = new URLSearchParams({ endpoint });
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-data?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch dashboard data');
  }

  const result = await response.json();
  return result.data;
}

export async function fetchSummary(dateFrom?: string, dateTo?: string): Promise<SummaryData> {
  const data = await fetchDashboard<SummaryData>('summary', dateFrom, dateTo);
  return data[0];
}

export async function fetchTrafficDaily(dateFrom?: string, dateTo?: string): Promise<TrafficDaily[]> {
  return fetchDashboard<TrafficDaily>('traffic_daily', dateFrom, dateTo);
}

export async function fetchSalesDaily(dateFrom?: string, dateTo?: string): Promise<SalesDaily[]> {
  return fetchDashboard<SalesDaily>('sales_daily', dateFrom, dateTo);
}

export async function fetchCampaigns(dateFrom?: string, dateTo?: string): Promise<CampaignData[]> {
  return fetchDashboard<CampaignData>('campaigns', dateFrom, dateTo);
}
