import {
  BarChart as RechartsBarChart,
  Bar as RechartsBar,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid as RechartsCartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer as RechartsResponsiveContainer,
} from "recharts";

const BarChart = RechartsBarChart as any;
const Bar = RechartsBar as any;
const XAxis = RechartsXAxis as any;
const YAxis = RechartsYAxis as any;
const CartesianGrid = RechartsCartesianGrid as any;
const Tooltip = RechartsTooltip as any;
const ResponsiveContainer = RechartsResponsiveContainer as any;
import type { SalesDaily } from "@/lib/dashboard-api";
import { formatDayMonth } from "@/lib/date-utils";

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

  const chartData = (data || [])
    .sort((a, b) => String(a.dia).localeCompare(String(b.dia)))
    .map((d) => ({
      dia: formatDayMonth(String(d.dia)),
      "Vendas Aprovadas": Number(d.vendas_aprovadas),
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
          <Bar dataKey="Vendas Aprovadas" fill="hsl(160, 84%, 44%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
