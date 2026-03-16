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
    { etapa: 'Cliques Link', valor: totalCliquesLink, taxaAnterior: '', pctTopo: '100%' },
    { etapa: 'Views Página', valor: totalViews, taxaAnterior: totalCliquesLink > 0 ? ((totalViews / totalCliquesLink) * 100).toFixed(1) + '%' : '0%', pctTopo: totalCliquesLink > 0 ? ((totalViews / totalCliquesLink) * 100).toFixed(1) + '%' : '0%' },
    { etapa: 'Checkouts', valor: totalCheckouts, taxaAnterior: totalViews > 0 ? ((totalCheckouts / totalViews) * 100).toFixed(1) + '%' : '0%', pctTopo: totalCliquesLink > 0 ? ((totalCheckouts / totalCliquesLink) * 100).toFixed(1) + '%' : '0%' },
    { etapa: 'Vendas', valor: totalVendas, taxaAnterior: totalCheckouts > 0 ? ((totalVendas / totalCheckouts) * 100).toFixed(1) + '%' : '0%', pctTopo: totalCliquesLink > 0 ? ((totalVendas / totalCliquesLink) * 100).toFixed(1) + '%' : '0%' },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-xs font-semibold text-foreground mb-1">{d.etapa}</p>
        <p className="text-sm font-display font-bold text-foreground">{formatNumber(d.valor)}</p>
        {d.taxaAnterior && <p className="text-[10px] text-muted-foreground">Conv. etapa anterior: {d.taxaAnterior}</p>}
        <p className="text-[10px] text-muted-foreground">% do topo: {d.pctTopo}</p>
      </div>
    );
  };

  const CustomBarLabel = (props: any) => {
    const { x, y, width, height, value, index } = props;
    const entry = funnelData[index];
    if (!entry) return null;
    const labelText = entry.taxaAnterior
      ? `${formatNumber(value)} (${entry.taxaAnterior})`
      : formatNumber(value);
    return (
      <text x={(x || 0) + (width || 0) + 6} y={(y || 0) + (height || 0) / 2} dy={4} fill="hsl(215, 12%, 55%)" fontSize={10} textAnchor="start">
        {labelText}
      </text>
    );
  };

  return (
    <div className="chart-container">
      <h3 className="dashboard-section-title mb-4">Funil de Tráfego</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" horizontal={false} />
          <XAxis type="number" tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
          <YAxis type="category" dataKey="etapa" tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 11 }} width={90} />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="valor"
            radius={[0, 6, 6, 0]}
            label={<CustomBarLabel />}
          >
            {funnelData.map((entry, i) => (
              <Cell key={i} fill={FUNNEL_COLORS[i]} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Inside-bar % labels rendered as overlay */}
      <div className="relative -mt-[280px] h-[260px] pointer-events-none" style={{ marginLeft: 90, marginRight: 80 }}>
        {funnelData.map((entry, i) => {
          if (i === 0 || totalCliquesLink === 0) return null;
          const barWidthPct = (entry.valor / totalCliquesLink) * 100;
          const topOffset = 20 + i * 62; // approximate bar positions
          if (barWidthPct < 5) return null; // too small for label
          return (
            <div
              key={i}
              className="absolute text-[10px] font-semibold text-white"
              style={{
                left: 0,
                width: `${barWidthPct}%`,
                top: topOffset,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {entry.pctTopo}
            </div>
          );
        })}
      </div>
      <div className="mt-5" /> {/* spacer to compensate negative margin */}
    </div>
  );
}
