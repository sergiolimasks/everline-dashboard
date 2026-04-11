import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { admin } from "@/lib/api";
import { LogIn, ArrowLeft } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn(email, password);
    if (result.error) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }

    // signIn just populated AuthContext. Re-derive admin from the fresh user
    // instead of reading from context (which won't have re-rendered yet).
    try {
      const me = await admin.listMyRoles();
      const adminRoles = new Set(["admin", "super_admin", "gestor"]);
      const hasAdminAccess = me.some((r) => adminRoles.has(r.role));

      if (hasAdminAccess) {
        navigate("/painel");
        return;
      }

      // Regular users land on whichever client they have access to.
      // listMyAccess may return multiple rows; pick the first client's slug.
      const myAccess = await admin.listMyAccess();
      if (myAccess.length > 0) {
        // We need the client slug, not the client_id. Fetch clients once.
        const clients = await admin.listClients();
        const firstClient = clients.find((c) => c.id === myAccess[0].client_id);
        if (firstClient) {
          navigate(`/cliente/${firstClient.slug}/painel`);
          return;
        }
      }
      navigate("/");
    } catch {
      // If the role/access lookup fails, fall back to home — user is still
      // signed in, they just hit an unexpected error on the post-login routing.
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold font-display text-primary">Ever Line</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acesse seu painel de performance</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors justify-center">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
