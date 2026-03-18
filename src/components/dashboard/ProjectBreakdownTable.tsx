import { useSummary } from "@/hooks/use-dashboard";

interface ProjectBreakdownTableProps {
  dateFrom: string;
  dateTo: string;
  dateLabel: string;
  isGestor?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface ProjectRowData {
  label: string;
  investimento: number;
  faturamento: number;
  lucro: number;
  isLoading: boolean;
}

function useProjectMetrics(dateFrom: string, dateTo: string, project?: string) {
  const { data, isLoading } = useSummary(dateFrom, dateTo, "all", project);

  const gastoMeta = Number(data?.traffic?.total_gasto || 0);
  const imposto = gastoMeta * 0.125;

  // Checkup has extra costs
  const isCheckup = !project || project === "checkup";
  const vendasAprovadas = Number(data?.sales?.vendas_aprovadas || 0);
  const custoConsultas = isCheckup ? Number(data?.sales?.taxa_fixa || 0) : 0;
  const custoManychat = isCheckup ? vendasAprovadas * 0.35 : 0;

  const investimento = gastoMeta + imposto + custoConsultas + custoManychat;
  const faturamento = Number(data?.sales?.receita_liquida || 0);
  const lucro = faturamento - investimento;

  return { investimento, faturamento, lucro, isLoading };
}

export function ProjectBreakdownTable({ dateFrom, dateTo, dateLabel, isGestor }: ProjectBreakdownTableProps) {
  const checkup = useProjectMetrics(dateFrom, dateTo, "checkup");
  const formacao = useProjectMetrics(dateFrom, dateTo, "formacao-consultor");
  const nutri = useProjectMetrics(dateFrom, dateTo, "nutri");

  const projects: ProjectRowData[] = [
    { label: "Checkup", ...checkup },
    { label: "Formação", ...formacao },
    { label: "Nutri", ...nutri },
  ];

  const anyLoading = projects.some((p) => p.isLoading);

  const totals = projects.reduce(
    (acc, p) => ({
      investimento: acc.investimento + p.investimento,
      faturamento: acc.faturamento + p.faturamento,
      lucro: acc.lucro + p.lucro,
    }),
    { investimento: 0, faturamento: 0, lucro: 0 }
  );

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 md:p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Resumo por Projeto ({dateLabel})
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Projeto</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Investimento</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Faturamento</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Lucro</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.label} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-medium text-foreground">{p.label}</td>
                <td className="py-2.5 px-3 text-right text-red-400 font-medium">
                  {p.isLoading ? "..." : formatCurrency(p.investimento)}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-400 font-medium">
                  {p.isLoading ? "..." : formatCurrency(p.faturamento)}
                </td>
                <td className={`py-2.5 px-3 text-right font-semibold ${p.lucro >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {p.isLoading ? "..." : formatCurrency(p.lucro)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/20">
              <td className="py-2.5 px-3 font-semibold text-foreground">Total</td>
              <td className="py-2.5 px-3 text-right text-red-400 font-semibold">
                {anyLoading ? "..." : formatCurrency(totals.investimento)}
              </td>
              <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">
                {anyLoading ? "..." : formatCurrency(totals.faturamento)}
              </td>
              <td className={`py-2.5 px-3 text-right font-bold ${totals.lucro >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {anyLoading ? "..." : formatCurrency(totals.lucro)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
