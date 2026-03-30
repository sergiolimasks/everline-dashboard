import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { TrafficDaily, SalesDaily, SummaryData } from "@/lib/dashboard-api";
import { estimateCheckoutSeries, getEstimatedCheckoutsForDay, isDateInRange } from "@/lib/checkout-estimation";

interface TrafficChartProps {
  data: TrafficDaily[] | undefined;
  salesData?: SalesDaily[] | undefined;
  summaryData?: SummaryData;
  isLoading: boolean;
  showLeads?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR');
}

const FUNNEL_COLORS = [
  'hsl(200, 80%, 50%)',   // Cliques Link
  'hsl(270, 60%, 60%)',   // Views Página
  'hsl(45, 90%, 55%)',    // Iniciou Checkout
  'hsl(160, 84%, 44%)',   // Vendas
];

const FUNNEL_COLORS_LEADS = [
  'hsl(200, 80%, 50%)',   // Cliques Link
  'hsl(270, 60%, 60%)',   // Views Página
  'hsl(30, 90%, 55%)',    // Leads (orange)
  'hsl(160, 84%, 44%)',   // Vendas
];

export function TrafficChart({ data, salesData, isLoading, summaryData, showLeads = false, dateFrom, dateTo }: TrafficChartProps) {
  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Funil de Tráfego</h3>
        <div className="h-72 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const totalCliquesLink = Number(summaryData?.traffic?.total_cliques_link || 0);
  const totalViews = Number(summaryData?.traffic?.total_views || 0);
  const totalCheckouts = Number(summaryData?.traffic?.total_checkouts || 0);
  const totalVendas = Number(summaryData?.sales?.vendas_aprovadas || 0);
  const totalLeads = Number(summaryData?.traffic?.total_leads || 0);

  const estimatedCheckoutByDate = estimateCheckoutSeries(data, salesData);
  const adjustedTotalCheckouts = !showLeads && data && data.length > 0
    ? data
        .filter((d) => isDateInRange(d.dia, dateFrom, dateTo))
        .reduce((sum, d) => sum + getEstimatedCheckoutsForDay(estimatedCheckoutByDate, d), 0)
    : 0;
  const effectiveTotalCheckouts = !showLeads && adjustedTotalCheckouts > 0 ? adjustedTotalCheckouts : totalCheckouts;

  let funnelData: Array<{ etapa: string; valor: number; taxaAnterior: string; pctTopo: string }>;

  if (showLeads) {
    // Funnel with Leads (no checkout): Cliques Link → Views Página → Leads → Vendas
    funnelData = [
      { etapa: 'Cliques Link', valor: totalCliquesLink, taxaAnterior: '', pctTopo: '' },
      { etapa: 'Views Página', valor: totalViews, taxaAnterior: totalCliquesLink > 0 ? ((totalViews / totalCliquesLink) * 100).toFixed(1) + '%' : '0%', pctTopo: totalCliquesLink > 0 ? ((totalViews / totalCliquesLink) * 100).toFixed(1) + '%' : '0%' },
      { etapa: 'Leads', valor: totalLeads, taxaAnterior: totalViews > 0 ? ((totalLeads / totalViews) * 100).toFixed(1) + '%' : '0%', pctTopo: totalCliquesLink > 0 ? ((totalLeads / totalCliquesLink) * 100).toFixed(1) + '%' : '0%' },
      { etapa: 'Vendas', valor: totalVendas, taxaAnterior: totalLeads > 0 ? ((totalVendas / totalLeads) * 100).toFixed(1) + '%' : '0%', pctTopo: totalCliquesLink > 0 ? ((totalVendas / totalCliquesLink) * 100).toFixed(1) + '%' : '0%' },
    ];
  } else {
    // Original funnel without leads
    funnelData = [
      { etapa: 'Cliques Link', valor: totalCliquesLink, taxaAnterior: '', pctTopo: '' },
      { etapa: 'Views Página', valor: totalViews, taxaAnterior: totalCliquesLink > 0 ? ((totalViews / totalCliquesLink) * 100).toFixed(1) + '%' : '0%', pctTopo: totalCliquesLink > 0 ? ((totalViews / totalCliquesLink) * 100).toFixed(1) + '%' : '0%' },
      { etapa: 'Iniciou Checkout', valor: effectiveTotalCheckouts, taxaAnterior: totalViews > 0 ? ((effectiveTotalCheckouts / totalViews) * 100).toFixed(1) + '%' : '0%', pctTopo: totalCliquesLink > 0 ? ((effectiveTotalCheckouts / totalCliquesLink) * 100).toFixed(1) + '%' : '0%' },
      { etapa: 'Vendas', valor: totalVendas, taxaAnterior: effectiveTotalCheckouts > 0 ? ((totalVendas / effectiveTotalCheckouts) * 100).toFixed(1) + '%' : '0%', pctTopo: totalCliquesLink > 0 ? ((totalVendas / totalCliquesLink) * 100).toFixed(1) + '%' : '0%' },
    ];
  }

  const colors = showLeads ? FUNNEL_COLORS_LEADS : FUNNEL_COLORS;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-xs font-semibold text-foreground mb-1">{d.etapa}</p>
        <p className="text-sm font-display font-bold text-foreground">{formatNumber(d.valor)}</p>
        {d.taxaAnterior && <p className="text-[10px] text-muted-foreground">Conv. etapa anterior: {d.taxaAnterior}</p>}
        {d.pctTopo && <p className="text-[10px] text-muted-foreground">% do topo: {d.pctTopo}</p>}
      </div>
    );
  };

  const CustomBarLabel = (props: any) => {
    const { x, y, width, height, index } = props;
    const entry = funnelData[index];
    if (!entry) return null;
    const text = entry.taxaAnterior
      ? `${formatNumber(entry.valor)} (${entry.taxaAnterior})`
      : formatNumber(entry.valor);
    return (
      <text x={(x || 0) + (width || 0) + 6} y={(y || 0) + (height || 0) / 2 + 4} fill="hsl(215, 12%, 55%)" fontSize={10} textAnchor="start">
        {text}
      </text>
    );
  };

  const CustomInsideLabel = (props: any) => {
    const { x, y, width, height, index } = props;
    const entry = funnelData[index];
    if (!entry || !entry.taxaAnterior || (width || 0) < 35) return null;
    return (
      <text x={(x || 0) + (width || 0) / 2} y={(y || 0) + (height || 0) / 2 + 4} fill="white" fontSize={11} fontWeight={600} textAnchor="middle">
        {entry.taxaAnterior}
      </text>
    );
  };

  return (
    <div className="chart-container">
      <h3 className="dashboard-section-title mb-4">Funil de Tráfego</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 90 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" horizontal={false} />
          <XAxis type="number" tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
          <YAxis type="category" dataKey="etapa" tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 11 }} width={100} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
            {funnelData.map((_, i) => (
              <Cell key={i} fill={colors[i]} fillOpacity={0.8} />
            ))}
            <LabelList content={CustomBarLabel} />
            <LabelList content={CustomInsideLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
