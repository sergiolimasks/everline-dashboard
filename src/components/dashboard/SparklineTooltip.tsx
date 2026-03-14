import { LineChart, Line, ReferenceLine, ResponsiveContainer, Dot } from "recharts";
import type { TrafficDaily } from "@/lib/dashboard-api";

interface SparklineTooltipProps {
  dailyData: TrafficDaily[];
  metricFn: (d: TrafficDaily) => number;
  formatValue: (v: number) => string;
  label: string;
}

export function SparklineTooltip({ dailyData, metricFn, formatValue, label }: SparklineTooltipProps) {
  if (!dailyData || dailyData.length === 0) {
    return (
      <div className="w-72 p-3">
        <p className="text-xs font-semibold mb-1 text-foreground">{label} — Linha do Tempo</p>
        <p className="text-[10px] text-muted-foreground">Selecione um período maior para ver o gráfico</p>
      </div>
    );
  }

  const chartData = dailyData.map((d) => ({
    dia: d.dia,
    value: metricFn(d),
  }));

  const avg = chartData.reduce((s, d) => s + d.value, 0) / chartData.length;

  return (
    <div className="w-72 p-3">
      <p className="text-xs font-semibold mb-1 text-foreground">{label} — Linha do Tempo</p>
      <p className="text-[10px] text-muted-foreground mb-2">
        Média: <span className="font-medium text-foreground">{formatValue(avg)}</span>
      </p>
      <div className="h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <ReferenceLine
              y={avg}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 3"
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const isAbove = payload.value > avg * 1.05;
                const isBelow = payload.value < avg * 0.95;
                if (!isAbove && !isBelow) return <Dot cx={cx} cy={cy} r={0} fill="none" stroke="none" />;
                return (
                  <Dot
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill={isAbove ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                    stroke="hsl(var(--card))"
                    strokeWidth={1.5}
                  />
                );
              }}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>{chartData[0]?.dia}</span>
        <span>{chartData[chartData.length - 1]?.dia}</span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[9px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Acima da média</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Abaixo da média</span>
      </div>
    </div>
  );
}
