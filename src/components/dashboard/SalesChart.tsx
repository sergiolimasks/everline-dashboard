import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { SalesDaily } from "@/lib/dashboard-api";

interface SalesChartProps {
  data: SalesDaily[] | undefined;
  isLoading: boolean;
}

export function SalesChart({ data, isLoading }: SalesChartProps) {
  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Vendas por Dia</h3>
        <div className="h-72 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Aggregate by day
  const dailyMap = new Map<string, { dia: string; checkup: number; orderbumps: number; receita: number }>();

  (data || []).forEach((d) => {
    const key = d.dia;
    const existing = dailyMap.get(key) || { dia: key, checkup: 0, orderbumps: 0, receita: 0 };
    const prodLower = (d.produto || '').toLowerCase();

    if (prodLower.includes('checkup') || prodLower.includes('vida financeira')) {
      existing.checkup += Number(d.vendas_aprovadas);
    } else {
      existing.orderbumps += Number(d.vendas_aprovadas);
    }
    existing.receita += Number(d.receita_liquida);
    dailyMap.set(key, existing);
  });

  const chartData = Array.from(dailyMap.values())
    .sort((a, b) => a.dia.localeCompare(b.dia))
    .map((d) => ({
      dia: new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      "Checkup Vida Financeira": d.checkup,
      "Order Bumps": d.orderbumps,
    }));

  return (
    <div className="chart-container">
      <h3 className="dashboard-section-title mb-4">Vendas por Dia</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
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
          <Bar dataKey="Checkup Vida Financeira" fill="hsl(160, 84%, 44%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Order Bumps" fill="hsl(200, 80%, 50%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
