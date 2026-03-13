import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { TrafficDaily, SalesDaily } from "@/lib/dashboard-api";
import { formatDayMonth } from "@/lib/date-utils";

interface FunnelChartProps {
  trafficData: TrafficDaily[] | undefined;
  salesData: SalesDaily[] | undefined;
  isLoading: boolean;
}

export function RevenueVsSpendChart({ trafficData, salesData, isLoading }: FunnelChartProps) {
  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Gasto vs Receita Diária</h3>
        <div className="h-72 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const gastoMap = new Map<string, number>();
  (trafficData || []).forEach((d) => {
    gastoMap.set(d.dia, Number(d.gasto));
  });

  const receitaMap = new Map<string, number>();
  (salesData || []).forEach((d) => {
    const existing = receitaMap.get(d.dia) || 0;
    receitaMap.set(d.dia, existing + Number(d.receita_liquida));
  });

  const allDays = new Set([...gastoMap.keys(), ...receitaMap.keys()]);
  const chartData = Array.from(allDays)
    .sort()
    .map((dia) => ({
      dia: formatDayMonth(dia),
      Gasto: gastoMap.get(dia) || 0,
      "Receita Líquida": receitaMap.get(dia) || 0,
    }));

  return (
    <div className="chart-container">
      <h3 className="dashboard-section-title mb-4">Gasto vs Receita Diária</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorGasto" x1="0" y1="0" x2="0" y2="1">
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
          <YAxis tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(220, 18%, 12%)',
              border: '1px solid hsl(220, 14%, 18%)',
              borderRadius: '8px',
              color: 'hsl(210, 20%, 92%)',
            }}
            formatter={(value: number) =>
              new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
            }
          />
          <Legend />
          <Area type="monotone" dataKey="Gasto" stroke="hsl(0, 72%, 55%)" fillOpacity={1} fill="url(#colorGasto)" />
          <Area type="monotone" dataKey="Receita Líquida" stroke="hsl(160, 84%, 44%)" fillOpacity={1} fill="url(#colorReceita)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
