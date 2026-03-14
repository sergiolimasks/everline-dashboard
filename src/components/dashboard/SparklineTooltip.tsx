import { useState, useCallback } from "react";
import { LineChart, Line, ReferenceLine, ResponsiveContainer, Dot, Tooltip as RechartsTooltip } from "recharts";
import type { TrafficDaily } from "@/lib/dashboard-api";

interface SparklineTooltipProps {
  dailyData: TrafficDaily[];
  metricFn: (d: TrafficDaily) => number;
  formatValue: (v: number) => string;
  label: string;
}

function formatDayLabel(dia: string) {
  try {
    const d = new Date(dia);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return dia;
  }
}

function CustomTooltipContent({ active, payload, avg, formatValue }: any) {
  if (!active || !payload?.[0]) return null;
  const { dia, value } = payload[0].payload;
  const diff = avg !== 0 ? ((value - avg) / Math.abs(avg)) * 100 : 0;
  const isAbove = value > avg;

  return (
    <div className="bg-popover border border-border rounded-md px-2.5 py-1.5 shadow-lg text-[10px]">
      <p className="font-semibold text-foreground mb-0.5">{formatDayLabel(dia)}</p>
      <p className="text-foreground">Valor: <span className="font-medium">{formatValue(value)}</span></p>
      <p className="text-muted-foreground">Média: <span className="font-medium">{formatValue(avg)}</span></p>
      <p className={isAbove ? 'text-primary' : 'text-destructive'}>
        {diff >= 0 ? '+' : ''}{diff.toFixed(1)}% vs média
      </p>
    </div>
  );
}

export function SparklineTooltip({ dailyData, metricFn, formatValue, label }: SparklineTooltipProps) {
  if (!dailyData || dailyData.length === 0) {
    return (
      <div className="w-72 p-3">
        <p className="text-xs font-semibold mb-1 text-foreground">{label} — Últimos 20 dias</p>
        <p className="text-[10px] text-muted-foreground">Dados insuficientes para o gráfico</p>
      </div>
    );
  }

  const chartData = dailyData.map((d) => ({
    dia: d.dia,
    value: metricFn(d),
  }));

  const avg = chartData.reduce((s, d) => s + d.value, 0) / chartData.length;

  return (
    <div className="w-80 p-3" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs font-semibold mb-1 text-foreground">{label} — Últimos 20 dias</p>
      <p className="text-[10px] text-muted-foreground mb-2">
        Média: <span className="font-medium text-foreground">{formatValue(avg)}</span>
        <span className="ml-2">({chartData.length} dias)</span>
      </p>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <ReferenceLine
              y={avg}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 3"
              strokeWidth={1}
            />
            <RechartsTooltip
              content={<CustomTooltipContent avg={avg} formatValue={formatValue} />}
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
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
              activeDot={{
                r: 4,
                stroke: "hsl(var(--foreground))",
                strokeWidth: 2,
                fill: "hsl(var(--card))",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>{formatDayLabel(chartData[0]?.dia)}</span>
        <span>{formatDayLabel(chartData[chartData.length - 1]?.dia)}</span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[9px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Acima da média</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Abaixo da média</span>
      </div>
    </div>
  );
}
