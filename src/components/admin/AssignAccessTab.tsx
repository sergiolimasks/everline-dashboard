import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserCheck, Plus, X } from "lucide-react";
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

interface UserRole {
  id: string;
  user_id: string;
  role: string;
}

export function AssignAccessTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [offers, setOffers] = useState<ClientOffer[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedOffer, setSelectedOffer] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"user" | "admin" | "super_admin">("user");

  const loadData = async () => {
    const [{ data: p }, { data: a }, { data: o }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, email"),
      supabase.from("user_campaign_access").select("id, user_id, offer_slug, label"),
      supabase.from("client_offers").select("offer_slug, label"),
      supabase.from("user_roles").select("id, user_id, role"),
    ]);
    setProfiles(p || []);
    setAccess(a || []);
    setOffers(o || []);
    setRoles(r || []);
    if (p && p.length > 0 && !selectedUser) setSelectedUser(p[0].user_id);
    if (o && o.length > 0 && !selectedOffer) setSelectedOffer(o[0].offer_slug);
  };

  useEffect(() => { loadData(); }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedOffer) return;
    setLoading(true);

    const offer = offers.find((o) => o.offer_slug === selectedOffer);
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
      loadData();
    }
    setLoading(false);
  };

  const handleRemoveAccess = async (id: string) => {
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

  const getRoleName = (role: string) => {
    if (role === "super_admin") return "Super Admin";
    if (role === "admin") return "Admin";
    return "Cliente";
  };

  // Build grouped data: one row per user
  const getUsersWithRolesAndAccess = () => {
    // Get unique user_ids from both access and roles
    const userIds = new Set<string>();
    access.forEach((a) => userIds.add(a.user_id));
    roles.forEach((r) => userIds.add(r.user_id));

    return Array.from(userIds).map((userId) => {
      const userRoles = roles.filter((r) => r.user_id === userId);
      const userAccess = access.filter((a) => a.user_id === userId);
      const highestRole = userRoles.find((r) => r.role === "super_admin")
        || userRoles.find((r) => r.role === "admin")
        || userRoles.find((r) => r.role === "user")
        || null;

      return {
        userId,
        name: getUserName(userId),
        role: highestRole?.role || "user",
        isAdminOrSuper: highestRole?.role === "admin" || highestRole?.role === "super_admin",
        dashboards: userAccess,
      };
    });
  };

  const usersData = getUsersWithRolesAndAccess();

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

      {/* Current access list - grouped by user */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Acessos atribuídos</p>
        {usersData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acesso atribuído.</p>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Usuário</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Papel</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Dashboards</th>
                </tr>
              </thead>
              <tbody>
                {usersData.map((user) => (
                  <tr key={user.userId} className="border-t border-border">
                    <td className="px-4 py-2.5 text-foreground">{user.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        user.role === "super_admin"
                          ? "bg-primary/20 text-primary"
                          : user.role === "admin"
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {getRoleName(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {user.isAdminOrSuper ? (
                        <span className="text-muted-foreground text-xs italic">Todos</span>
                      ) : user.dashboards.length === 0 ? (
                        <span className="text-muted-foreground text-xs italic">Nenhum</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {user.dashboards.map((d) => (
                            <span
                              key={d.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground text-xs"
                            >
                              {d.label || d.offer_slug}
                              <button
                                onClick={() => handleRemoveAccess(d.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                title="Remover acesso"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
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
