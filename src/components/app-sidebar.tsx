import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingCart, Package, Tags, Truck, Users, ClipboardList,
  Undo2, BarChart3, UserCog, Settings, Store, Database, BookOpen,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useSettings } from "@/lib/settings";
import { usePermissions, type PageKey } from "@/lib/permissions";

type Item = { title: string; url: string; icon: any; page: PageKey };
const items: Item[] = [
  { title: "Dashboard",     url: "/dashboard",  icon: LayoutDashboard, page: "dashboard" },
  { title: "POS / New Sale",url: "/pos",        icon: ShoppingCart,    page: "pos" },
  { title: "Products",      url: "/products",   icon: Package,         page: "products" },
  { title: "Categories",    url: "/categories", icon: Tags,            page: "categories" },
  { title: "Suppliers",     url: "/suppliers",  icon: Truck,           page: "suppliers" },
  { title: "Customers",     url: "/customers",  icon: Users,           page: "customers" },
  { title: "Purchases",     url: "/purchases",  icon: ClipboardList,   page: "purchases" },
  { title: "Returns",       url: "/returns",    icon: Undo2,           page: "returns" },
  { title: "Reports",       url: "/reports",    icon: BarChart3,       page: "reports" },
  { title: "Users",         url: "/users",      icon: UserCog,         page: "users" },
  { title: "Settings",      url: "/settings",   icon: Settings,        page: "settings" },
  { title: "Demo Data",     url: "/seed-demo",  icon: Database,        page: "seed-demo" },
  { title: "Setup Guide",   url: "/docs",       icon: BookOpen,        page: "docs" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const settings = useSettings();
  const { can } = usePermissions();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/80 bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border/80 p-3">
        <div className={`flex items-center gap-3 rounded-2xl bg-white/[0.04] py-3 ${collapsed ? "justify-center px-0" : "px-3"}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/10 ring-1 ring-white/10">
            {settings.store_logo_url
              ? <img src={settings.store_logo_url} alt="" className="h-full w-full bg-white object-contain p-1" />
              : <Store className="h-5 w-5" />}
          </div>
          {!collapsed && (
            <a href="/dashboard" className="flex min-w-0 flex-col overflow-hidden">
              <span className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">{settings.store_name || "POS Store"}</span>
              <span className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/55">POS & Inventory</span>
            </a>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup className="p-0">
          {/* {!collapsed && <SidebarGroupLabel className="px-3 text-sidebar-foreground/45">Main Menu</SidebarGroupLabel>} */}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {items.filter(i => can(i.page)).map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title} className="h-10 rounded-xl px-3 text-sidebar-foreground/75 hover:bg-white/[0.08] hover:text-sidebar-foreground data-[active=true]:bg-white/[0.12] data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-sm">
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
