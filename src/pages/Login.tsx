import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

    const { error, data } = await signIn(email, password);
    if (error) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }

    // Check if user is admin
    const userId = data?.user?.id;
    if (userId) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (roleData) {
        navigate("/painel");
      } else {
        // Regular user - redirect to their client dashboard
        const { data: access } = await supabase
          .from("user_campaign_access")
          .select("offer_slug")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        if (access?.offer_slug) {
          navigate(`/cliente/${access.offer_slug}/checkup-performance`);
        } else {
          navigate("/");
        }
      }
    }
    setLoading(false);
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
