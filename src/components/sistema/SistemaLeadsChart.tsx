import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { TrafficDaily } from "@/lib/dashboard-api";

interface Props {
  data: TrafficDaily[] | undefined;
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
}

export function SistemaLeadsChart({ data, isLoading, dateFrom, dateTo }: Props) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return [...data]
      .filter(d => d.dia >= dateFrom && d.dia <= dateTo)
      .sort((a, b) => a.dia.localeCompare(b.dia))
      .map(d => ({
        dia: d.dia.slice(5), // MM-DD
        leads: Number(d.compras || 0),
        gasto: Number(d.gasto || 0),
        cliques: Number(d.cliques_link || 0),
      }));
  }, [data, dateFrom, dateTo]);

  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Leads por Dia</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3 className="dashboard-section-title mb-4">Leads por Dia</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => {
                if (name === 'gasto') return [`R$ ${value.toFixed(2)}`, 'Gasto'];
                if (name === 'leads') return [value, 'Leads'];
                return [value, 'Cliques'];
              }}
            />
            <Area type="monotone" dataKey="leads" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="cliques" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.05} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
