import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ClientOffer {
  id: string;
  offer_slug: string;
  label: string;
  client_id: string;
}

interface Client {
  id: string;
  name: string;
  slug: string;
}

export function ManagePermissionsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [offers, setOffers] = useState<ClientOffer[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    const [{ data: c }, { data: o }] = await Promise.all([
      supabase.from("clients").select("id, name, slug"),
      supabase.from("client_offers").select("id, offer_slug, label, client_id"),
    ]);
    setClients(c || []);
    setOffers(o || []);
    if (c && c.length > 0 && !selectedClient) setSelectedClient(c[0].id);
  };

  useEffect(() => { loadData(); }, []);

  const handleAddOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel || !newSlug || !selectedClient) return;
    setLoading(true);

    const { error } = await supabase.from("client_offers").insert({
      client_id: selectedClient,
      offer_slug: newSlug,
      label: newLabel,
    });

    if (error) {
      toast.error("Erro ao criar permissão: " + error.message);
    } else {
      toast.success("Permissão criada!");
      setNewLabel("");
      setNewSlug("");
      loadData();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("client_offers").delete().eq("id", id);
    if (error) toast.error("Erro ao remover");
    else {
      toast.success("Removido!");
      loadData();
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
