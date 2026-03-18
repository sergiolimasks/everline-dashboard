import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isGestor: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isGestor, setIsGestor] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);

  const checkRoles = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (data || []).map((r: any) => r.role);
    setIsAdmin(roles.includes("admin") || roles.includes("super_admin") || roles.includes("gestor"));
    setIsSuperAdmin(roles.includes("super_admin"));
    setIsGestor(roles.includes("gestor"));
  };

  useEffect(() => {
    // Get initial session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      lastUserIdRef.current = session?.user?.id ?? null;
      if (session?.user) {
        checkRoles(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        const newUserId = newSession?.user?.id ?? null;

        // Only update state if the user actually changed (sign in/out)
        // Skip TOKEN_REFRESHED events that don't change the user
        if (event === 'TOKEN_REFRESHED' && newUserId === lastUserIdRef.current) {
          // Just update the session/token silently without triggering re-renders
          // that would reset child component state
          setSession(newSession);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || newUserId !== lastUserIdRef.current) {
          lastUserIdRef.current = newUserId;
          setSession(newSession);
          setUser(newSession?.user ?? null);
          if (newSession?.user) {
            checkRoles(newSession.user.id);
          } else {
            setIsAdmin(false);
            setIsSuperAdmin(false);
            setIsGestor(false);
          }
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isSuperAdmin, isGestor, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
