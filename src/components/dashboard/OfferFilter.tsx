import { Filter } from "lucide-react";

export type OfferType = string;

interface OfferOption {
  value: string;
  label: string;
}

interface OfferFilterProps {
  selected: OfferType;
  onChange: (offer: OfferType) => void;
  options?: OfferOption[];
}

const defaultOffers: OfferOption[] = [
  { value: 'all', label: 'Todas Ofertas' },
  { value: 'com_ob', label: 'Checkup c/ OB' },
  { value: 'sem_ob', label: 'Checkup s/ OB' },
  { value: '147', label: 'Checkup 147' },
  { value: '197', label: 'Checkup 197' },
  { value: '247', label: 'Checkup 247' },
];

export function OfferFilter({ selected, onChange, options }: OfferFilterProps) {
  const items = options || defaultOffers;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <div className="flex gap-2">
        {items.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              selected === o.value
                ? "border-primary bg-primary/15 text-primary shadow-sm shadow-primary/10"
                : "border-border bg-card text-secondary-foreground hover:border-primary/50 hover:text-primary"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
