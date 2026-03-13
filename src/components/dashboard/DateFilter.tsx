import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { formatDateString } from "@/lib/date-utils";

interface DateFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
}

export function DateFilter({ dateFrom, dateTo, onDateChange }: DateFilterProps) {
  const [activePreset, setActivePreset] = useState<string | null>("Hoje");

  const presets = [
    { label: "Hoje", days: 0 },
    { label: "Ontem", days: -1 },
    { label: "7 dias", days: 7 },
    { label: "14 dias", days: 14 },
    { label: "30 dias", days: 30 },
    { label: "60 dias", days: 60 },
    { label: "90 dias", days: 90 },
  ];

  const applyPreset = (label: string, days: number) => {
    const to = new Date();
    const from = new Date();
    if (days === -1) {
      // Ontem
      to.setDate(to.getDate() - 1);
      from.setDate(from.getDate() - 1);
    } else if (days > 0) {
      from.setDate(from.getDate() - days);
    }
    setActivePreset(label);
    onDateChange(formatDateString(from), formatDateString(to));
  };

  const handleManualDate = (from: string, to: string) => {
    setActivePreset(null);
    onDateChange(from, to);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <div className="flex gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.label, p.days)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              activePreset === p.label
                ? "border-primary bg-primary/15 text-primary shadow-sm shadow-primary/10"
                : "border-border bg-card text-secondary-foreground hover:border-primary/50 hover:text-primary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => handleManualDate(e.target.value, dateTo)}
          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-secondary-foreground"
        />
        <span className="text-muted-foreground text-xs">até</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => handleManualDate(dateFrom, e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-secondary-foreground"
        />
      </div>
    </div>
  );
}
