import { useCallback, useEffect, useState } from "react";
import { ApiError, admin, type Client, type ClientOffer } from "@/lib/api";
import { Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ManagePermissionsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [offers, setOffers] = useState<ClientOffer[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [c, o] = await Promise.all([admin.listClients(), admin.listClientOffers()]);
      setClients(c);
      setOffers(o);
      setSelectedClient((current) => current || c[0]?.id || "");
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao carregar dados"));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel || !newSlug || !selectedClient) return;
    setLoading(true);
    try {
      await admin.createClientOffer(selectedClient, newSlug, newLabel);
      toast.success("Permissão criada!");
      setNewLabel("");
      setNewSlug("");
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao criar permissão"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await admin.deleteClientOffer(id);
      toast.success("Removido!");
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao remover"));
    }
  };

  const getClientName = (clientId: string) => clients.find((c) => c.id === clientId)?.name || "—";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Cargos de Permissão</h3>
        <p className="text-sm text-muted-foreground">Gerencie os dashboards/ofertas que podem ser atribuídos aos usuários.</p>
      </div>

      <form onSubmit={handleAddOffer} className="max-w-md space-y-4 p-4 rounded-xl border border-border bg-card">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Cliente</label>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Nome do Dashboard</label>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            required
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Ex: Checkup de Performance"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Slug da Oferta</label>
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            required
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Ex: checkup-performance"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Shield className="h-4 w-4" />
          {loading ? "Criando..." : "Criar Permissão"}
        </button>
      </form>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Permissões existentes</p>
        {offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma permissão cadastrada.</p>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Cliente</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Dashboard</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Slug</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-foreground">{getClientName(o.client_id)}</td>
                    <td className="px-4 py-2.5 text-foreground">{o.label}</td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{o.offer_slug}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => handleDelete(o.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
