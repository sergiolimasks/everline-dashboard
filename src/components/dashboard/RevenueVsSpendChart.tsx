import { ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceDot } from "recharts";
import type { TrafficDaily, SalesDaily } from "@/lib/dashboard-api";
import { formatDayMonth } from "@/lib/date-utils";

interface FunnelChartProps {
  trafficData: TrafficDaily[] | undefined;
  salesData: SalesDaily[] | undefined;
  isLoading: boolean;
  clientView?: boolean;
  showLeads?: boolean;
  hideCoProdutor?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function RevenueVsSpendChart({ trafficData, salesData, isLoading, clientView = false, showLeads = false, hideCoProdutor = false }: FunnelChartProps) {
  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Custo Total vs Receita Diária</h3>
        <div className="h-72 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const gastoMetaMap = new Map<string, number>();
  (trafficData || []).forEach((d) => {
    gastoMetaMap.set(d.dia, Number(d.gasto) * 1.125);
  });

  const receitaMap = new Map<string, number>();
  const receitaBrutaMap = new Map<string, number>();
  const taxaFixaMap = new Map<string, number>();
  const vendasMap = new Map<string, number>();
  const coProdutorMap = new Map<string, number>();
  (salesData || []).forEach((d) => {
    receitaMap.set(d.dia, (receitaMap.get(d.dia) || 0) + Number(d.receita_liquida));
    receitaBrutaMap.set(d.dia, (receitaBrutaMap.get(d.dia) || 0) + Number(d.receita_bruta || 0));
    taxaFixaMap.set(d.dia, (taxaFixaMap.get(d.dia) || 0) + Number(d.taxa_fixa));
    vendasMap.set(d.dia, (vendasMap.get(d.dia) || 0) + Number(d.vendas_aprovadas));
    coProdutorMap.set(d.dia, (coProdutorMap.get(d.dia) || 0) + Number(d.co_produtor || 0));
  });

  const allDays = new Set([...gastoMetaMap.keys(), ...receitaMap.keys()]);
  const chartData = Array.from(allDays)
    .sort()
    .map((dia) => {
      const gastoMeta = gastoMetaMap.get(dia) || 0;
      const taxaFixa = showLeads ? 0 : (taxaFixaMap.get(dia) || 0);
      const vendas = vendasMap.get(dia) || 0;
      const custoManychat = showLeads ? 0 : vendas * 0.35;
      const coProdutor = hideCoProdutor ? 0 : (coProdutorMap.get(dia) || 0);
      const custoTotal = gastoMeta + taxaFixa + custoManychat;
      const receita = receitaMap.get(dia) || 0;
      const receitaBruta = receitaBrutaMap.get(dia) || 0;

      const vendasCnpj = vendasCnpjMap.get(dia) || 0;
      const cacTotal = gastoMeta + taxaFixa + custoManychat + coProdutor;
      const vendasParaCac = vendas + vendasCnpj;
      const cac = vendasParaCac > 0 ? cacTotal / vendasParaCac : 0;
      const receitaPorVenda = vendasParaCac > 0 ? receitaBruta / vendasParaCac : 0;

      return {
        dia: formatDayMonth(dia),
        "Custo Total": custoTotal,
        "Receita Líquida": receita,
        "Co-Produtor": coProdutor,
        "CAC": cac,
        "Receita/Venda": receitaPorVenda,
        gastoMeta,
        taxaFixa,
        custoManychat,
      };
    });

  const custoValues = chartData.map(d => d["Custo Total"]);
  const receitaValues = chartData.map(d => d["Receita Líquida"]);

  const maxCustoIdx = custoValues.indexOf(Math.max(...custoValues));
  const minCustoIdx = custoValues.indexOf(Math.min(...custoValues.filter(v => v > 0)));
  const maxReceitaIdx = receitaValues.indexOf(Math.max(...receitaValues));
  const minReceitaIdx = receitaValues.indexOf(Math.min(...receitaValues.filter(v => v > 0)));

  const peaks: Array<{ index: number; dataKey: string; color: string; value: number }> = [];

  if (chartData.length > 2) {
    if (maxCustoIdx >= 0) peaks.push({ index: maxCustoIdx, dataKey: "Custo Total", color: "hsl(0, 72%, 55%)", value: custoValues[maxCustoIdx] });
    if (minCustoIdx >= 0 && minCustoIdx !== maxCustoIdx) peaks.push({ index: minCustoIdx, dataKey: "Custo Total", color: "hsl(0, 72%, 55%)", value: custoValues[minCustoIdx] });
    if (maxReceitaIdx >= 0) peaks.push({ index: maxReceitaIdx, dataKey: "Receita Líquida", color: "hsl(160, 84%, 44%)", value: receitaValues[maxReceitaIdx] });
    if (minReceitaIdx >= 0 && minReceitaIdx !== maxReceitaIdx) peaks.push({ index: minReceitaIdx, dataKey: "Receita Líquida", color: "hsl(160, 84%, 44%)", value: receitaValues[minReceitaIdx] });
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex justify-between gap-4">
            <span className="text-destructive font-medium">Custo Total</span>
            <span className="font-semibold text-destructive">{formatCurrency(data?.["Custo Total"] || 0)}</span>
          </div>
          <div className="pl-3 space-y-0.5 text-[10px] text-muted-foreground">
            <div className="flex justify-between gap-3">
              <span>Meta Ads + Imposto</span>
              <span>{formatCurrency(data?.gastoMeta || 0)}</span>
            </div>
            {!showLeads && (
              <div className="flex justify-between gap-3">
                <span>Consultas</span>
                <span>{formatCurrency(data?.taxaFixa || 0)}</span>
              </div>
            )}
            {!showLeads && (
              <div className="flex justify-between gap-3">
                <span>ManyChat</span>
                <span>{formatCurrency(data?.custoManychat || 0)}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-primary font-medium">Receita Líquida</span>
            <span className="font-semibold text-primary">{formatCurrency(data?.["Receita Líquida"] || 0)}</span>
          </div>
          {!clientView && !hideCoProdutor && (
            <div className="flex justify-between gap-4">
              <span className="font-medium" style={{ color: 'hsl(210, 70%, 55%)' }}>Co-Produtor</span>
              <span className="font-semibold" style={{ color: 'hsl(210, 70%, 55%)' }}>{formatCurrency(data?.["Co-Produtor"] || 0)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="font-medium" style={{ color: 'hsl(35, 90%, 55%)' }}>CAC</span>
            <span className="font-semibold" style={{ color: 'hsl(35, 90%, 55%)' }}>{formatCurrency(data?.["CAC"] || 0)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="font-medium" style={{ color: 'hsl(270, 60%, 60%)' }}>Receita/Venda</span>
            <span className="font-semibold" style={{ color: 'hsl(270, 60%, 60%)' }}>{formatCurrency(data?.["Receita/Venda"] || 0)}</span>
          </div>
          <div className="border-t border-border pt-1.5 flex justify-between gap-4">
            <span className="text-muted-foreground font-medium">Resultado</span>
            <span className={`font-semibold ${(data?.["Receita Líquida"] || 0) >= (data?.["Custo Total"] || 0) ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency((data?.["Receita Líquida"] || 0) - (data?.["Custo Total"] || 0))}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="chart-container">
      <h3 className="dashboard-section-title mb-4">Custo Total vs Receita Diária</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(160, 84%, 44%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(160, 84%, 44%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
          <XAxis dataKey="dia" tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 10 }} tickFormatter={(v: number) => `R$${v.toFixed(0)}`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar yAxisId="right" dataKey="CAC" fill="hsl(35, 90%, 55%)" opacity={0.5} barSize={8} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="right" dataKey="Receita/Venda" fill="hsl(270, 60%, 60%)" opacity={0.5} barSize={8} radius={[2, 2, 0, 0]} />
          <Area yAxisId="left" type="monotone" dataKey="Custo Total" stroke="hsl(0, 72%, 55%)" strokeWidth={2} fillOpacity={1} fill="url(#colorCusto)" />
          <Area yAxisId="left" type="monotone" dataKey="Receita Líquida" stroke="hsl(160, 84%, 44%)" strokeWidth={2} fillOpacity={1} fill="url(#colorReceita)" />
          {!clientView && !hideCoProdutor && <Line yAxisId="left" type="monotone" dataKey="Co-Produtor" stroke="hsl(210, 70%, 55%)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />}
          {peaks.map((p, i) => (
            <ReferenceDot
              key={i}
              x={chartData[p.index]?.dia}
              y={p.value}
              yAxisId="left"
              r={5}
              fill={p.color}
              stroke="hsl(220, 18%, 12%)"
              strokeWidth={2}
              label={{
                value: formatCurrency(p.value),
                position: p.value === Math.max(...(p.dataKey === "Custo Total" ? custoValues : receitaValues)) ? 'top' : 'bottom',
                fill: p.color,
                fontSize: 10,
                fontWeight: 600,
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
