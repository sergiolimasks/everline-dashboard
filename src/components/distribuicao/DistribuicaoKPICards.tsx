import { Eye, MousePointerClick, DollarSign, Repeat, Radio } from "lucide-react";

interface KPIData {
  totalGasto: number;
  totalImpressoes: number;
  totalAlcance: number;
  totalCliquesLink: number;
  totalViews3s: number;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function formatNumber(v: number) {
  return v.toLocaleString('pt-BR');
}

export function DistribuicaoKPICards({ data, isLoading, clientView = false }: { data: KPIData | null; isLoading: boolean; clientView?: boolean }) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="chart-container animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const cpc = data.totalCliquesLink > 0 ? data.totalGasto / data.totalCliquesLink : 0;
  const cpm = data.totalImpressoes > 0 ? (data.totalGasto / data.totalImpressoes) * 1000 : 0;
  const tsr = data.totalImpressoes > 0 ? (data.totalViews3s / data.totalImpressoes) * 100 : 0;
  const frequencia = data.totalAlcance > 0 ? data.totalImpressoes / data.totalAlcance : 0;

  const allCards = [
    { label: 'Investimento', value: formatCurrency(data.totalGasto), icon: DollarSign, accent: 'text-destructive' },
    { label: 'Impressões', value: formatNumber(data.totalImpressoes), icon: Eye, accent: 'text-primary' },
    { label: 'Alcance', value: formatNumber(data.totalAlcance), icon: Radio, accent: 'text-primary' },
    { label: 'Cliques no Link', value: formatNumber(data.totalCliquesLink), icon: MousePointerClick, accent: 'text-primary' },
    { label: 'CPC', value: formatCurrency(cpc), icon: MousePointerClick, accent: 'text-muted-foreground' },
    { label: 'CPM', value: formatCurrency(cpm), icon: DollarSign, accent: 'text-accent-foreground' },
    { label: 'TSR', value: `${tsr.toFixed(2)}%`, icon: Eye, accent: 'text-primary' },
    { label: 'Frequência', value: frequencia.toFixed(2), icon: Repeat, accent: 'text-primary' },
  ];

  const clientKeys = ['Investimento', 'Impressões', 'Alcance', 'Frequência'];
  const cards = clientView ? allCards.filter(c => clientKeys.includes(c.label)) : allCards;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="chart-container flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <c.icon className={`h-4 w-4 ${c.accent}`} />
            <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
          </div>
          <span className="text-xl md:text-2xl font-bold font-display text-foreground">{c.value}</span>
        </div>
      ))}
    </div>
  );
}
