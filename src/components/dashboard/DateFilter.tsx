import { Calendar } from "lucide-react";
import { formatDateString } from "@/lib/date-utils";

interface DateFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
}

export function DateFilter({ dateFrom, dateTo, onDateChange }: DateFilterProps) {
  const presets = [
    { label: "Hoje", days: 0 },
    { label: "7 dias", days: 7 },
    { label: "14 dias", days: 14 },
    { label: "30 dias", days: 30 },
    { label: "60 dias", days: 60 },
    { label: "90 dias", days: 90 },
  ];

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    if (days > 0) {
      from.setDate(from.getDate() - days);
    }
    onDateChange(formatDateString(from), formatDateString(to));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <div className="flex gap-2">
        {presets.map((p) => (
          <button
            key={p.days}
            onClick={() => applyPreset(p.days)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-secondary-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateChange(e.target.value, dateTo)}
          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-secondary-foreground"
        />
        <span className="text-muted-foreground text-xs">até</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateChange(dateFrom, e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-secondary-foreground"
        />
      </div>
    </div>
  );
}
