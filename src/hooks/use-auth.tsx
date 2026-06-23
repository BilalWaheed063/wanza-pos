import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "cashier";
export type AccountStatus = "pending" | "active" | "disabled";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  fullName: string;
  role: AppRole | null;
  status: AccountStatus | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  fullName: "",
  role: null,
  status: null,
  loading: true,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("full_name,status").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).order("role").limit(1).maybeSingle(),
    ]);
    setFullName(p?.full_name ?? "");
    setStatus(((p as any)?.status as AccountStatus) ?? "active");
    setRole((r?.role as AppRole) ?? "cashier");
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setRole(null);
        setStatus(null);
        setFullName("");
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };
  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, fullName, role, status, loading, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
