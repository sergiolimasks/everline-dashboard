import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";

const UNPAID_ACCOUNTS = [
  { conta: "1202066241345194", total: 59592.18 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function UnpaidAccountsTable() {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">Contas não Pagas</h2>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID da Conta</TableHead>
              <TableHead className="text-right">Total Não Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {UNPAID_ACCOUNTS.map((acc) => (
              <TableRow key={acc.conta}>
                <TableCell className="font-mono text-sm">{acc.conta}</TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {formatCurrency(acc.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
