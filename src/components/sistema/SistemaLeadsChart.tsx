import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import type { TrafficDaily } from "@/lib/dashboard-api";

interface Props {
  data: TrafficDaily[] | undefined;
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function SistemaLeadsChart({ data, isLoading, dateFrom, dateTo }: Props) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return [...data]
      .filter(d => d.dia >= dateFrom && d.dia <= dateTo)
      .sort((a, b) => a.dia.localeCompare(b.dia))
      .map(d => {
        const leads = Number(d.leads || 0);
        const gasto = Number(d.gasto || 0);
        const cpl = leads > 0 ? gasto / leads : 0;
        return {
          dia: d.dia.slice(5), // MM-DD
          leads,
          cpl: Number(cpl.toFixed(2)),
        };
      });
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
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => {
                if (name === 'cpl') return [formatCurrency(value), 'CPL'];
                return [value, 'Leads'];
              }}
            />
            <Legend formatter={(value) => value === 'cpl' ? 'CPL' : 'Leads'} />
            <Bar yAxisId="left" dataKey="leads" fill="hsl(var(--primary))" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cpl" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
