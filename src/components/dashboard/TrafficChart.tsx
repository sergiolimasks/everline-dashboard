import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { TrafficDaily } from "@/lib/dashboard-api";
import type { SalesDaily } from "@/lib/dashboard-api";
import { formatDayMonth } from "@/lib/date-utils";

interface TrafficChartProps {
  data: TrafficDaily[] | undefined;
  salesData?: SalesDaily[] | undefined;
  isLoading: boolean;
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR');
}

const FUNNEL_COLORS = [
  'hsl(200, 80%, 50%)',  // Cliques Link
  'hsl(270, 60%, 60%)',  // Views Página
  'hsl(45, 90%, 55%)',   // Checkouts
  'hsl(160, 84%, 44%)',  // Vendas
];

export function TrafficChart({ data, salesData, isLoading }: TrafficChartProps) {
  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Funil de Tráfego</h3>
        <div className="h-72 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const trafficArr = [...(data || [])].sort((a, b) => String(a.dia).localeCompare(String(b.dia)));
  
  const totalCliquesLink = trafficArr.reduce((s, d) => s + Number(d.cliques_link), 0);
  const totalViews = trafficArr.reduce((s, d) => s + Number(d.views_pagina), 0);
  const totalCheckouts = trafficArr.reduce((s, d) => s + Number(d.checkouts), 0);
  
  const salesArr = salesData || [];
  const totalVendas = salesArr.reduce((s, d) => s + Number(d.vendas_aprovadas), 0);

  const funnelData = [
    { etapa: 'Cliques Link', valor: totalCliquesLink, taxa: '100%' },
    { etapa: 'Views Página', valor: totalViews, taxa: totalCliquesLink > 0 ? ((totalViews / totalCliquesLink) * 100).toFixed(1) + '%' : '0%' },
    { etapa: 'Checkouts', valor: totalCheckouts, taxa: totalViews > 0 ? ((totalCheckouts / totalViews) * 100).toFixed(1) + '%' : '0%' },
    { etapa: 'Vendas', valor: totalVendas, taxa: totalCheckouts > 0 ? ((totalVendas / totalCheckouts) * 100).toFixed(1) + '%' : '0%' },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-xs font-semibold text-foreground mb-1">{d.etapa}</p>
        <p className="text-sm font-display font-bold text-foreground">{formatNumber(d.valor)}</p>
        <p className="text-[10px] text-muted-foreground">Taxa: {d.taxa}</p>
      </div>
    );
  };

  return (
    <div className="chart-container">
      <h3 className="dashboard-section-title mb-4">Funil de Tráfego</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" horizontal={false} />
          <XAxis type="number" tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
          <YAxis type="category" dataKey="etapa" tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 11 }} width={100} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="valor" radius={[0, 6, 6, 0]} label={{ position: 'right', fill: 'hsl(215, 12%, 55%)', fontSize: 10, formatter: (v: number, _: any, entry: any) => `${formatNumber(v)} (${entry?.payload?.taxa || ''})` }}>
            {funnelData.map((_, i) => (
              <Cell key={i} fill={FUNNEL_COLORS[i]} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
