import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export function CreateUserTab() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email, password, role: "user", displayName: name },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao criar usuário");
      } else {
        toast.success("Usuário criado com sucesso!");
        setName("");
        setEmail("");
        setPassword("");
      }
    } catch {
      toast.error("Erro ao criar usuário");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Cadastrar Novo Usuário</h3>
        <p className="text-sm text-muted-foreground">Crie uma conta para um novo usuário do sistema.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Nome completo"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="email@exemplo.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          {loading ? "Criando..." : "Criar Usuário"}
        </button>
      </form>
    </div>
  );
}
