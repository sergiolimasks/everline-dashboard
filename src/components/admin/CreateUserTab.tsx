import { useCallback, useEffect, useState } from "react";
import { ApiError, admin, type Profile } from "@/lib/api";
import { UserPlus, Trash2, KeyRound, X } from "lucide-react";
import { toast } from "sonner";

export function CreateUserTab() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [changingPassword, setChangingPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const profiles = await admin.listProfiles();
      setUsers(profiles);
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao carregar usuários"));
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);
    try {
      await admin.createUser({ email, password, role: "user", displayName: name });
      toast.success("Usuário criado com sucesso!");
      setName("");
      setEmail("");
      setPassword("");
      await loadUsers();
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao criar usuário"));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await admin.changePassword(userId, newPassword);
      toast.success("Senha alterada com sucesso!");
      setChangingPassword(null);
      setNewPassword("");
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao alterar senha"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setLoading(true);
    try {
      await admin.deleteUser(userId);
      toast.success("Usuário excluído com sucesso!");
      setDeletingUser(null);
      await loadUsers();
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao excluir usuário"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Create user form */}
      <div className="max-w-md space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Cadastrar Novo Usuário</h3>
          <p className="text-sm text-muted-foreground">Crie uma conta para um novo usuário do sistema.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Nome completo" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Mínimo 6 caracteres" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            <UserPlus className="h-4 w-4" />
            {loading ? "Criando..." : "Criar Usuário"}
          </button>
        </form>
      </div>

      {/* User list */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Usuários Cadastrados</h3>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">E-mail</th>
                  <th className="px-4 py-2.5 text-right text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-foreground">{u.display_name || "—"}</td>
                    <td className="px-4 py-2.5 text-foreground">{u.email || "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        {changingPassword === u.user_id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Nova senha"
                              minLength={6}
                              className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <button
                              onClick={() => handleChangePassword(u.user_id)}
                              disabled={loading}
                              className="px-2 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => { setChangingPassword(null); setNewPassword(""); }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setChangingPassword(u.user_id)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Alterar senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                        )}

                        {deletingUser === u.user_id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-destructive">Confirmar?</span>
                            <button
                              onClick={() => handleDeleteUser(u.user_id)}
                              disabled={loading}
                              className="px-2 py-1 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                            >
                              Sim
                            </button>
                            <button
                              onClick={() => setDeletingUser(null)}
                              className="px-2 py-1 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingUser(u.user_id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Excluir usuário"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
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
