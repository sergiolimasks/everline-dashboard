import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  admin,
  type CampaignAccess,
  type Client,
  type ClientOffer,
  type Profile,
  type UserRoleRow,
} from "@/lib/api";
import { UserCheck, Plus, X } from "lucide-react";
import { toast } from "sonner";

type AppRole = "user" | "gestor" | "admin" | "super_admin";

export function AssignAccessTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [access, setAccess] = useState<CampaignAccess[]>([]);
  const [offers, setOffers] = useState<ClientOffer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedOffer, setSelectedOffer] = useState("__all__");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>("user");

  const loadData = useCallback(async () => {
    try {
      const [p, a, o, r, c] = await Promise.all([
        admin.listProfiles(),
        admin.listAccess(),
        admin.listClientOffers(),
        admin.listUserRoles(),
        admin.listClients(),
      ]);
      setProfiles(p);
      setAccess(a);
      setOffers(o);
      setRoles(r);
      setClients(c);
      setSelectedUser((current) => current || p[0]?.user_id || "");
      setSelectedClient((current) => current || c[0]?.id || "");
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao carregar dados"));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter offers by selected client
  const filteredOffers = offers.filter((o) => o.client_id === selectedClient);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedClient) return;
    setLoading(true);

    // If "Todos" is selected, assign all offers for this client
    const offersToAssign =
      selectedOffer === "__all__"
        ? filteredOffers
        : filteredOffers.filter((o) => o.offer_slug === selectedOffer);

    if (offersToAssign.length === 0) {
      toast.error("Nenhum dashboard encontrado para este cliente.");
      setLoading(false);
      return;
    }

    let assigned = 0;
    let skippedExisting = 0;
    for (const offer of offersToAssign) {
      const exists = access.find(
        (a) =>
          a.user_id === selectedUser &&
          a.client_id === selectedClient &&
          a.offer_slug === offer.offer_slug,
      );
      if (exists) {
        skippedExisting++;
        continue;
      }
      try {
        await admin.assignAccess(
          selectedUser,
          selectedClient,
          offer.offer_slug,
          offer.label || offer.offer_slug,
        );
        assigned++;
      } catch (err) {
        // 409 = "already assigned" (race); anything else is a real error
        if (err instanceof ApiError && err.status === 409) {
          skippedExisting++;
        } else {
          toast.error(errorMessage(err, `Erro ao atribuir ${offer.label}`));
        }
      }
    }

    if (assigned > 0) {
      toast.success(`${assigned} acesso(s) atribuído(s)!`);
      await loadData();
    } else if (skippedExisting > 0) {
      toast.error("Usuário já tem acesso a todos os dashboards selecionados.");
    }
    setLoading(false);
  };

  const handleAssignRole = async () => {
    if (!selectedUser) return;
    setLoading(true);

    // user_roles has UNIQUE(user_id) now — assignRole is an upsert server-side.
    // So re-assigning the same role is a no-op, and a different role replaces.
    const existing = roles.find((r) => r.user_id === selectedUser);
    if (existing && existing.role === selectedRole) {
      toast.error("Usuário já possui esse papel.");
      setLoading(false);
      return;
    }

    try {
      await admin.assignRole(selectedUser, selectedRole);
      toast.success(`Papel "${selectedRole}" atribuído!`);
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao atribuir papel"));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAccess = async (id: string) => {
    try {
      await admin.removeAccess(id);
      toast.success("Acesso removido!");
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao remover"));
    }
  };

  const getUserName = (userId: string) => {
    const p = profiles.find((p) => p.user_id === userId);
    return p?.display_name || p?.email || userId.slice(0, 8);
  };

  const getRoleName = (role: string) => {
    if (role === "super_admin") return "Super Admin";
    if (role === "admin") return "Admin";
    if (role === "gestor") return "Gestor";
    return "Cliente";
  };

  const getRoleBadgeClass = (role: string) => {
    if (role === "super_admin") return "bg-primary/20 text-primary";
    if (role === "admin") return "bg-accent text-accent-foreground";
    if (role === "gestor") return "bg-blue-500/20 text-blue-400";
    return "bg-muted text-muted-foreground";
  };

  // Build grouped data: one row per user
  const getUsersWithRolesAndAccess = () => {
    const userIds = new Set<string>();
    access.forEach((a) => userIds.add(a.user_id));
    roles.forEach((r) => userIds.add(r.user_id));

    return Array.from(userIds).map((userId) => {
      // Post-migration, user_roles has UNIQUE(user_id) — only one role per user.
      const userRole = roles.find((r) => r.user_id === userId);
      const userAccess = access.filter((a) => a.user_id === userId);

      const role = userRole?.role || "user";
      const isAdminOrSuper = role === "admin" || role === "super_admin";
      const isGestor = role === "gestor";

      return {
        userId,
        name: getUserName(userId),
        role,
        isAdminOrSuper,
        isGestor,
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
            <label className="block text-sm font-medium text-foreground mb-1.5">Cliente</label>
            <select
              value={selectedClient}
              onChange={(e) => {
                setSelectedClient(e.target.value);
                setSelectedOffer("__all__");
              }}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
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
              <option value="__all__">Todos</option>
              {filteredOffers.map((o) => (
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
              onChange={(e) => setSelectedRole(e.target.value as AppRole)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="user">Usuário (Cliente)</option>
              <option value="gestor">Gestor</option>
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
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                        {getRoleName(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {user.isAdminOrSuper ? (
                        <span className="text-muted-foreground text-xs italic">Todos</span>
                      ) : user.isGestor ? (
                        user.dashboards.length === 0 ? (
                          <span className="text-muted-foreground text-xs italic">Todos (por cliente atribuído)</span>
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
                        )
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

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
