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
    total_views_3s: number;
    dias_ativos: number;
    total_leads: number;
  };
  sales: {
    vendas_aprovadas: number;
    vendas_bump: number;
    receita_bruta: number;
    receita_liquida: number;
    taxa_fixa: number;
    co_produtor: number;
    taxa_green: number;
    taxa_tmb: number;
  };
  products: Array<{
    produto: string;
    vendas_aprovadas: number;
    receita_bruta: number;
    receita_liquida: number;
  }>;
  parcelas?: {
    total_parcelas: number;
    valor_total: number;
    repasse: number;
    repasse_coprodutor: number;
    taxa_tmb: number;
    por_parcela?: Array<{
      parcela: number;
      quantidade: number;
      valor_total: number;
      repasse: number;
      repasse_coprodutor: number;
      taxa_tmb: number;
    }>;
  } | null;
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
  views_3s: number;
  leads: number;
}

export interface SalesDaily {
  dia: string;
  vendas_aprovadas: number;
  receita_bruta: number;
  receita_liquida: number;
  taxa_fixa: number;
  co_produtor: number;
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
  status?: string;
  endform?: number;
  lead_aplicacao?: number;
  lead_presencial?: number;
}

  meta_leads?: number;
}

export interface AdData {
  anuncio: string;
  impressoes: number;
  alcance: number;
  cliques: number;
  cliques_link: number;
  views_pagina: number;
  gasto: number;
  views_3s: number;
  compras: number;
  valor_compras: number;
  ctr: number;
  thumb_stop_rate: number;
  cpc: number;
  cpm: number;
  link: string | null;
  status?: string;
  endform?: number;
  lead_aplicacao?: number;
  lead_presencial?: number;
  meta_leads?: number;
}

async function fetchDashboard<T>(endpoint: string, dateFrom?: string, dateTo?: string, offer?: string, project?: string): Promise<T[]> {
  const params = new URLSearchParams({ endpoint });
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  if (offer && offer !== 'all') params.set('offer', offer);
  if (project && project !== 'checkup') params.set('project', project);

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

export async function fetchSummary(dateFrom?: string, dateTo?: string, offer?: string, project?: string): Promise<SummaryData> {
  const data = await fetchDashboard<SummaryData>('summary', dateFrom, dateTo, offer, project);
  return data[0];
}

export async function fetchTrafficDaily(dateFrom?: string, dateTo?: string, offer?: string, project?: string): Promise<TrafficDaily[]> {
  return fetchDashboard<TrafficDaily>('traffic_daily', dateFrom, dateTo, offer, project);
}

export async function fetchSalesDaily(dateFrom?: string, dateTo?: string, offer?: string, project?: string): Promise<SalesDaily[]> {
  return fetchDashboard<SalesDaily>('sales_daily', dateFrom, dateTo, offer, project);
}

export async function fetchCampaigns(dateFrom?: string, dateTo?: string, offer?: string, project?: string): Promise<CampaignData[]> {
  return fetchDashboard<CampaignData>('campaigns', dateFrom, dateTo, offer, project);
}

export async function fetchAds(dateFrom?: string, dateTo?: string, offer?: string, project?: string): Promise<AdData[]> {
  return fetchDashboard<AdData>('ads', dateFrom, dateTo, offer, project);
}

export interface AttributionData {
  source: string;
  gasto: number;
  leads: number;
  cpl: number;
  vendas: number;
  cpa: number;
  roi: number;
  lucro: number;
  receita_bruta: number;
  receita_liquida: number;
  taxa_conversao: number;
}

export async function fetchAttribution(dateFrom?: string, dateTo?: string, offer?: string, project?: string): Promise<AttributionData[]> {
  return fetchDashboard<AttributionData>('attribution', dateFrom, dateTo, offer, project);
}
