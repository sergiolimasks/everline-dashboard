import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { TrafficDaily } from "@/lib/dashboard-api";
import { formatDayMonth } from "@/lib/date-utils";

interface TrafficChartProps {
  data: TrafficDaily[] | undefined;
  isLoading: boolean;
}

export function TrafficChart({ data, isLoading }: TrafficChartProps) {
  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Tráfego Diário</h3>
        <div className="h-72 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const chartData = [...(data || [])].reverse().map((d) => ({
    dia: new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    Cliques: Number(d.cliques),
    "Views Página": Number(d.views_pagina),
    Checkouts: Number(d.checkouts),
    Gasto: Number(d.gasto),
  }));

  return (
    <div className="chart-container">
      <h3 className="dashboard-section-title mb-4">Tráfego Diário</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorCliques" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(270, 60%, 60%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(270, 60%, 60%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCheckouts" x1="0" y1="0" x2="0" y2="1">
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
          />
          <Legend />
          <Area type="monotone" dataKey="Cliques" stroke="hsl(200, 80%, 50%)" fillOpacity={1} fill="url(#colorCliques)" />
          <Area type="monotone" dataKey="Views Página" stroke="hsl(270, 60%, 60%)" fillOpacity={1} fill="url(#colorViews)" />
          <Area type="monotone" dataKey="Checkouts" stroke="hsl(160, 84%, 44%)" fillOpacity={1} fill="url(#colorCheckouts)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
