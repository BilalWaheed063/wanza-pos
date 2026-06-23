import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useApplyTheme, useSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({ ssr: false, component: AuthPage });

function AuthPage() {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const settings = useSettings();
  useApplyTheme(settings.theme_color);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!loading && session) nav({ to: "/dashboard", replace: true });
  }, [loading, session, nav]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data: auth, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setBusy(false); return toast.error(error.message); }
    // Check status before going to dashboard
    const uid = auth.user?.id;
    if (uid) {
      const { data: p } = await supabase.from("profiles").select("status").eq("id", uid).maybeSingle();
      const st = (p as any)?.status as string | undefined;
      if (st && st !== "active") {
        await supabase.auth.signOut();
        setBusy(false);
        return toast.error(
          st === "pending"
            ? "Your account is awaiting admin approval."
            : "Your account has been disabled. Contact the admin.",
        );
      }
    }
    setBusy(false);
    toast.success("Signed in");
    nav({ to: "/dashboard", replace: true });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    // Always sign out after signup so layout doesn't try to gate a pending user.
    await supabase.auth.signOut();
    setBusy(false);
    toast.success("Account created — waiting for admin approval. You'll be able to sign in once approved.");
    setEmail(""); setPassword(""); setFullName("");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_34rem)]" />
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow_main">
            {settings.store_logo_url
              ? <img src={settings.store_logo_url} alt="" className="h-full w-full bg-white object-contain p-1" />
              : <Store className="h-7 w-7" />}
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight">{settings.store_name || "POS Store"}</span>
            <p className="mt-1 text-sm text-muted-foreground">Secure store management portal</p>
          </div>
        </div>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in or request a new account to continue.</CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-5">
                <form onSubmit={signIn} className="space-y-4">
                  <div><Label>Email</Label><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
                  <div><Label>Password</Label><Input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></div>
                  <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in..." : "Sign In"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup" className="mt-5">
                <form onSubmit={signUp} className="space-y-4">
                  <div><Label>Full name</Label><Input required value={fullName} onChange={e=>setFullName(e.target.value)} /></div>
                  <div><Label>Email</Label><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
                  <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></div>
                  <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating..." : "Request account"}</Button>
                  <p className="text-xs text-muted-foreground">The first account becomes the admin automatically. All other signups need admin approval before they can log in.</p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
