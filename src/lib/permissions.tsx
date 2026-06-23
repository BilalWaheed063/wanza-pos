import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const ALL_PAGES = [
  "dashboard","pos","products","categories","customers","suppliers",
  "purchases","returns","reports","settings","users","docs","seed-demo",
] as const;
export type PageKey = typeof ALL_PAGES[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: "Dashboard",
  pos: "POS / New Sale",
  products: "Products",
  categories: "Categories",
  customers: "Customers",
  suppliers: "Suppliers",
  purchases: "Purchases",
  returns: "Returns",
  reports: "Reports",
  settings: "Settings",
  users: "Users & Roles",
  docs: "Setup Guide",
  "seed-demo": "Demo Data",
};

export function pageFromPath(path: string): PageKey | null {
  const seg = path.replace(/^\/+/, "").split("/")[0];
  if (!seg) return null;
  if ((ALL_PAGES as readonly string[]).includes(seg)) return seg as PageKey;
  return null;
}

/** Returns the set of allowed page keys for the currently signed-in user. */
export function usePermissions() {
  const { session, role } = useAuth();
  const q = useQuery({
    queryKey: ["my-allowed-pages", session?.user?.id],
    enabled: !!session?.user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_allowed_pages");
      if (error) throw error;
      const set = new Set<string>((data as any[] | null ?? []).map(r => r.page));
      return set;
    },
  });
  const allowed = q.data ?? new Set<string>();
  const can = (page: PageKey | null | undefined) => {
    if (!page) return true;
    if (role === "admin") return true;
    return allowed.has(page);
  };
  return { can, allowed, loaded: q.isSuccess || role === "admin" };
}
