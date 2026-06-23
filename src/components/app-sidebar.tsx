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
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className={`flex items-center gap-2 py-2 ${collapsed ? "justify-center px-0" : "px-2"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary text-primary-foreground">
            {settings.store_logo_url
              ? <img src={settings.store_logo_url} alt="" className="h-full w-full bg-white object-contain" />
              : <Store className="h-5 w-5" />}
          </div>
          {!collapsed && (
            <a href="/dashboard" className="flex min-w-0 flex-col overflow-hidden">
              <span className="truncate text-sm font-semibold">{settings.store_name}</span>
              <span className="truncate text-xs text-muted-foreground">POS & Inventory</span>
            </a>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {/* <SidebarGroupLabel>Main</SidebarGroupLabel> */}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.filter(i => can(i.page)).map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
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
