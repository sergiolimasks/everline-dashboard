import { useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateString, getWeekStart, parseDateStringLocal } from "@/lib/date-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DateFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
  weekStartDay?: number; // 0=Sun, 3=Wed, etc. Default 0
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function MiniCalendar({
  selected,
  onSelect,
}: {
  selected: Date;
  onSelect: (date: Date) => void;
}) {
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const [viewYear, setViewYear] = useState(selected.getFullYear());

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const isSelected = (day: number) =>
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day;

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day;

  return (
    <div className="w-64 p-3 pointer-events-auto">
      {/* Header with month/year + arrows */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((day, i) => (
          <div key={i} className="flex items-center justify-center">
            {day ? (
              <button
                onClick={() => onSelect(new Date(viewYear, viewMonth, day))}
                className={cn(
                  "w-8 h-8 rounded-md text-xs font-medium transition-colors",
                  isSelected(day)
                    ? "bg-primary text-primary-foreground"
                    : isToday(day)
                    ? "bg-accent/20 text-accent-foreground hover:bg-accent/40"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {day}
              </button>
            ) : (
              <div className="w-8 h-8" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DatePickerButton({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (dateStr: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const date = parseDateStringLocal(value);

  const displayDate = `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")}/${date.getFullYear()}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="px-3 py-1.5 h-auto text-xs font-normal border-border bg-card text-secondary-foreground gap-1.5"
        >
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {displayDate}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <MiniCalendar
          selected={date}
          onSelect={(d) => {
            onChange(formatDateString(d));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Get the most recent weekStartDay on or before the given date.
 */
function getWeekStart(ref: Date, startDay: number): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diff = (d.getDay() - startDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function DateFilter({ dateFrom, dateTo, onDateChange, weekStartDay = 0 }: DateFilterProps) {
  const [activePreset, setActivePreset] = useState<string | null>("Esta semana");

  const presets: { label: string; getRange: () => [Date, Date] }[] = [
    {
      label: "Hoje",
      getRange: () => {
        const today = new Date();
        return [today, today];
      },
    },
    {
      label: "Ontem",
      getRange: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return [yesterday, yesterday];
      },
    },
    {
      label: "Esta semana",
      getRange: () => {
        const today = new Date();
        const start = getWeekStart(today, weekStartDay);
        return [start, today];
      },
    },
    {
      label: "Semana passada",
      getRange: () => {
        const today = new Date();
        const thisStart = getWeekStart(today, weekStartDay);
        const prevEnd = new Date(thisStart);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(thisStart);
        prevStart.setDate(prevStart.getDate() - 7);
        return [prevStart, prevEnd];
      },
    },
    {
      label: "Este mês",
      getRange: () => {
        const to = new Date();
        const from = new Date(to.getFullYear(), to.getMonth(), 1);
        return [from, to];
      },
    },
    {
      label: "Mês passado",
      getRange: () => {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const to = new Date(now.getFullYear(), now.getMonth(), 0);
        return [from, to];
      },
    },
  ];

  const applyPreset = (preset: (typeof presets)[0]) => {
    const [from, to] = preset.getRange();
    setActivePreset(preset.label);
    onDateChange(formatDateString(from), formatDateString(to));
  };

  const handleFromChange = (val: string) => {
    setActivePreset(null);
    onDateChange(val, dateTo);
  };

  const handleToChange = (val: string) => {
    setActivePreset(null);
    onDateChange(dateFrom, val);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
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
        <DatePickerButton value={dateFrom} onChange={handleFromChange} label="De" />
        <span className="text-muted-foreground text-xs">até</span>
        <DatePickerButton value={dateTo} onChange={handleToChange} label="Até" />
      </div>
    </div>
  );
}
