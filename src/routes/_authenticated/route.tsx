import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut, Lock, Store } from "lucide-react";
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

const pageTitles: Record<string, { title: string; eyebrow: string }> = {
  "/dashboard": { title: "Dashboard", eyebrow: "Store performance" },
  "/pos": { title: "Point of Sale", eyebrow: "Fast checkout" },
  "/products": { title: "Products", eyebrow: "Inventory management" },
  "/categories": { title: "Categories", eyebrow: "Product organization" },
  "/suppliers": { title: "Suppliers", eyebrow: "Vendor directory" },
  "/customers": { title: "Customers", eyebrow: "Customer records" },
  "/purchases": { title: "Purchases", eyebrow: "Stock receiving" },
  "/returns": { title: "Returns", eyebrow: "Sales adjustments" },
  "/reports": { title: "Reports", eyebrow: "Business insights" },
  "/users": { title: "Users & Roles", eyebrow: "Access control" },
  "/settings": { title: "Settings", eyebrow: "Store configuration" },
  "/seed-demo": { title: "Demo Data", eyebrow: "Sample setup" },
  "/docs": { title: "Setup Guide", eyebrow: "Help center" },
  "/setup": { title: "First-time setup", eyebrow: "Store onboarding" },
};

function pageMeta(path: string) {
  return pageTitles[path] ?? { title: "Workspace", eyebrow: "POS & Inventory" };
}

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
  const meta = pageMeta(path);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-[89px] items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="h-10 w-10 rounded-xl border border-border/70 bg-card shadow-sm" />
              <div className="hidden min-w-0 flex-col sm:flex">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{meta.eyebrow}</span>
                <span className="truncate text-base font-bold text-foreground">{meta.title}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm lg:flex">
                <Store className="h-3.5 w-3.5" />
                {settings.store_name || "POS Store"}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-11 gap-2 rounded-full border border-border/70 bg-card/90 px-2.5 shadow-sm hover:bg-card">
                    <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">{initials}</AvatarFallback></Avatar>
                    <div className="hidden flex-col text-left sm:flex">
                      <span className="max-w-[180px] truncate text-sm font-semibold leading-none">{fullName || user?.email}</span>
                      <span className="mt-1 text-xs capitalize text-muted-foreground">{role}</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => { await signOut(); nav({ to: "/auth", replace: true }); }}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="relative flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full ">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
