import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserCheck, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  display_name: string | null;
  email: string | null;
}

interface AccessRow {
  id: string;
  user_id: string;
  offer_slug: string;
  label: string | null;
}

interface ClientOffer {
  offer_slug: string;
  label: string;
}

export function AssignAccessTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [offers, setOffers] = useState<ClientOffer[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedOffer, setSelectedOffer] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"user" | "admin" | "super_admin">("user");

  const loadData = async () => {
    const [{ data: p }, { data: a }, { data: o }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, email"),
      supabase.from("user_campaign_access").select("id, user_id, offer_slug, label"),
      supabase.from("client_offers").select("offer_slug, label"),
    ]);
    setProfiles(p || []);
    setAccess(a || []);
    setOffers(o || []);
    if (p && p.length > 0 && !selectedUser) setSelectedUser(p[0].user_id);
    if (o && o.length > 0 && !selectedOffer) setSelectedOffer(o[0].offer_slug);
  };

  useEffect(() => { loadData(); }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedOffer) return;
    setLoading(true);

    const offer = offers.find((o) => o.offer_slug === selectedOffer);

    // Check if already exists
    const exists = access.find((a) => a.user_id === selectedUser && a.offer_slug === selectedOffer);
    if (exists) {
      toast.error("Usuário já tem acesso a esse dashboard.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("user_campaign_access").insert({
      user_id: selectedUser,
      offer_slug: selectedOffer,
      label: offer?.label || selectedOffer,
    });

    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Acesso atribuído!");
      loadData();
    }
    setLoading(false);
  };

  const handleAssignRole = async () => {
    if (!selectedUser) return;
    setLoading(true);

    // First check if user already has this role
    const { data: existing } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", selectedUser)
      .eq("role", selectedRole as any);

    if (existing && existing.length > 0) {
      toast.error("Usuário já possui esse papel.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("user_roles").insert({
      user_id: selectedUser,
      role: selectedRole as any,
    });

    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success(`Papel "${selectedRole}" atribuído!`);
    }
    setLoading(false);
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("user_campaign_access").delete().eq("id", id);
    if (error) toast.error("Erro ao remover");
    else {
      toast.success("Acesso removido!");
      loadData();
    }
  };

  const getUserName = (userId: string) => {
    const p = profiles.find((p) => p.user_id === userId);
    return p?.display_name || p?.email || userId.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Atribuir Acessos</h3>
        <p className="text-sm text-muted-foreground">Vincule dashboards e papéis aos usuários cadastrados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Assign dashboard access */}
        <form onSubmit={handleAssign} className="space-y-4 p-4 rounded-xl border border-border bg-card">
          <p className="text-sm font-semibold text-foreground">Acesso a Dashboard</p>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Usuário</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {profiles.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.display_name || p.email || p.user_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Dashboard</label>
            <select
              value={selectedOffer}
              onChange={(e) => setSelectedOffer(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {offers.map((o) => (
                <option key={o.offer_slug} value={o.offer_slug}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {loading ? "Atribuindo..." : "Atribuir Acesso"}
          </button>
        </form>

        {/* Assign role */}
        <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
          <p className="text-sm font-semibold text-foreground">Papel do Usuário</p>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Usuário</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {profiles.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.display_name || p.email || p.user_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Papel</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as "user" | "admin" | "super_admin")}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="user">Usuário (Cliente)</option>
              <option value="admin">Administrador</option>
              <option value="super_admin">Super Administrador</option>
            </select>
          </div>
          <button
            onClick={handleAssignRole}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <UserCheck className="h-4 w-4" />
            {loading ? "Atribuindo..." : "Atribuir Papel"}
          </button>
        </div>
      </div>

      {/* Current access list */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Acessos atribuídos</p>
        {access.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acesso atribuído.</p>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Usuário</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Dashboard</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Slug</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {access.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-foreground">{getUserName(a.user_id)}</td>
                    <td className="px-4 py-2.5 text-foreground">{a.label || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{a.offer_slug}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => handleRemove(a.id)} className="text-muted-foreground hover:text-destructive transition-colors">
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
