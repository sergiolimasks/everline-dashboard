import { Users, DollarSign, MousePointerClick, Eye } from "lucide-react";

interface KPIData {
  totalLeads: number;
  totalGasto: number;
  totalCliquesLink: number;
  totalImpressoes: number;
  totalViewsPagina: number;
  totalCheckouts: number;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function formatNumber(v: number) {
  return v.toLocaleString('pt-BR');
}

export function SistemaKPICards({ data, isLoading, clientView = false }: { data: KPIData | null; isLoading: boolean; clientView?: boolean }) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="chart-container animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const cpl = data.totalLeads > 0 ? data.totalGasto / data.totalLeads : 0;
  const cpc = data.totalCliquesLink > 0 ? data.totalGasto / data.totalCliquesLink : 0;
  const ctr = data.totalImpressoes > 0 ? (data.totalCliquesLink / data.totalImpressoes) * 100 : 0;
  const taxaConversao = data.totalCliquesLink > 0 ? (data.totalLeads / data.totalCliquesLink) * 100 : 0;

  const allCards = [
    { label: 'Leads', value: formatNumber(data.totalLeads), icon: Users, accent: 'text-primary' },
    { label: 'Investimento', value: formatCurrency(data.totalGasto), icon: DollarSign, accent: 'text-destructive' },
    { label: 'CPL', value: formatCurrency(cpl), icon: DollarSign, accent: 'text-accent-foreground' },
    { label: 'CPC', value: formatCurrency(cpc), icon: MousePointerClick, accent: 'text-muted-foreground' },
    { label: 'CTR', value: `${ctr.toFixed(2)}%`, icon: MousePointerClick, accent: 'text-primary' },
    { label: 'Taxa Conversão', value: `${taxaConversao.toFixed(2)}%`, icon: Eye, accent: 'text-primary' },
    { label: 'Cliques no Link', value: formatNumber(data.totalCliquesLink), icon: MousePointerClick, accent: 'text-muted-foreground' },
    { label: 'Impressões', value: formatNumber(data.totalImpressoes), icon: Eye, accent: 'text-muted-foreground' },
  ];

  const clientKeys = ['Leads', 'Investimento', 'CPL'];
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
