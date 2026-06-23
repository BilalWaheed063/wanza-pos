import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useApplyTheme, useSettings, useSettingsQuery } from "@/lib/settings";
import { pageFromPath, usePermissions } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, loading, signOut, fullName, user, role, status, refresh } = useAuth();
  const nav = useNavigate();
  const settings = useSettings();
  const settingsQ = useSettingsQuery();
  const path = useRouterState({ select: r => r.location.pathname });
  const perms = usePermissions();
  useApplyTheme(settings.theme_color);

  // Sign out users whose account is not active.
  useEffect(() => {
    if (loading || !session || !status) return;
    if (status !== "active") {
      const msg = status === "pending"
        ? "Your account is awaiting admin approval."
        : "Your account has been disabled. Contact the admin.";
      (async () => {
        await signOut();
        toast.error(msg);
        nav({ to: "/auth", replace: true });
      })();
    }
  }, [loading, session, status, signOut, nav]);

  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth", replace: true });
  }, [loading, session, nav]);

  // Only redirect to /setup after settings have actually loaded, and only for admins.
  useEffect(() => {
    if (loading || !session || status !== "active") return;
    if (!settingsQ.isSuccess) return;
    if (!settings.setup_complete && role === "admin" && path !== "/setup") {
      nav({ to: "/setup", replace: true });
    }
  }, [loading, session, status, settingsQ.isSuccess, settings.setup_complete, role, path, nav]);

  // Per-page permission gate: redirect to /dashboard if the current page isn't allowed.
  useEffect(() => {
    if (loading || !session || status !== "active") return;
    if (!perms.loaded) return;
    const page = pageFromPath(path);
    if (!page) return;
    if (page === "dashboard") return;
    if (!perms.can(page)) {
      toast.error("You don't have access to that page");
      nav({ to: "/dashboard", replace: true });
    }
  }, [loading, session, status, perms.loaded, path, nav]); // eslint-disable-line

  // Re-check status when sidebar/path changes (covers approval flips during session)
  useEffect(() => { if (session) refresh(); }, [path]); // eslint-disable-line

  if (loading || !session) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (status && status !== "active") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">
          {status === "pending" ? "Awaiting admin approval" : "Account disabled"}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {status === "pending"
            ? "Your account was created but an admin needs to approve it before you can sign in."
            : "Your access has been disabled. Please contact the store administrator."}
        </p>
      </div>
    );
  }

  const initials = (fullName || user?.email || "U").split(/\s+/).map(s=>s[0]).slice(0,2).join("").toUpperCase();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-[69px] items-center justify-between border-b bg-background px-3 sm:px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2">
                  <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar>
                  <div className="hidden flex-col text-left sm:flex">
                    <span className="text-sm leading-none">{fullName || user?.email}</span>
                    <span className="text-xs capitalize text-muted-foreground">{role}</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); nav({ to: "/auth", replace: true }); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-3 sm:p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
