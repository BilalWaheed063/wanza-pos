import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { startOfDay, endOfDay } from "date-fns";
import { Package, ShoppingCart, TrendingUp, AlertTriangle, Warehouse, Plus, ClipboardList, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtMoney, useSettings } from "@/lib/settings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const settings = useSettings();
  const sym = settings.currency_symbol;

  const today = useQuery({
    queryKey: ["dash-today"],
    queryFn: async () => {
      const from = startOfDay(new Date()).toISOString();
      const to = endOfDay(new Date()).toISOString();
      const { data: sales } = await supabase
        .from("sales")
        .select("id,total,created_at,invoice_no,customer_id,payment_method,status,cashier_name,sale_items(quantity,unit_price,purchase_price)")
        .eq("status", "completed")
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false });
      const list = sales ?? [];
      let totalSales = 0, profit = 0;
      for (const s of list) {
        totalSales += Number(s.total);
        for (const it of (s.sale_items as any[]) ?? []) {
          profit += (Number(it.unit_price) - Number(it.purchase_price)) * Number(it.quantity);
        }
      }
      return { totalSales, profit, orders: list.length, recent: list.slice(0, 5) };
    },
  });

  const inv = useQuery({
    queryKey: ["dash-inv"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,name,stock_quantity,min_stock,purchase_price,selling_price,unit").eq("is_active", true);
      const list = data ?? [];
      const value = list.reduce((a, p: any) => a + Number(p.purchase_price) * Number(p.stock_quantity), 0);
      const lowStock = list.filter((p: any) => Number(p.stock_quantity) <= Number(p.min_stock));
      return { value, lowStock: lowStock.slice(0, 6), totalProducts: list.length };
    },
  });

  const best = useQuery({
    queryKey: ["dash-best"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sale_items")
        .select("product_name,quantity,total")
        .limit(500);
      const map = new Map<string, { qty: number; total: number }>();
      for (const r of (data as any[]) ?? []) {
        const cur = map.get(r.product_name) ?? { qty: 0, total: 0 };
        cur.qty += Number(r.quantity); cur.total += Number(r.total);
        map.set(r.product_name, cur);
      }
      return [...map.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of today's activity</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link to="/pos"><Plus className="mr-1 h-4 w-4" />New Sale</Link></Button>
          <Button asChild variant="outline"><Link to="/products"><Package className="mr-1 h-4 w-4" />Add Product</Link></Button>
          <Button asChild variant="outline"><Link to="/purchases"><ClipboardList className="mr-1 h-4 w-4" />Purchase</Link></Button>
          <Button asChild variant="outline"><Link to="/reports"><BarChart3 className="mr-1 h-4 w-4" />Reports</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Today's Sales" value={fmtMoney(today.data?.totalSales ?? 0, sym)} icon={<TrendingUp className="h-4 w-4" />} />
        <Stat label="Today's Orders" value={String(today.data?.orders ?? 0)} icon={<ShoppingCart className="h-4 w-4" />} />
        <Stat label="Today's Profit" value={fmtMoney(today.data?.profit ?? 0, sym)} icon={<TrendingUp className="h-4 w-4" />} />
        <Stat label="Low Stock" value={String(inv.data?.lowStock.length ?? 0)} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} />
        <Stat label="Inventory Value" value={fmtMoney(inv.data?.value ?? 0, sym)} icon={<Warehouse className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader>
          <CardContent>
            {today.data?.recent.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {today.data.recent.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.invoice_no}</TableCell>
                      <TableCell><Badge variant="secondary">{s.payment_method}</Badge></TableCell>
                      <TableCell className="text-right">{fmtMoney(s.total, sym)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <EmptyHint text="No sales yet today." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Best Selling Products</CardTitle></CardHeader>
          <CardContent>
            {best.data?.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty Sold</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                <TableBody>
                  {best.data.map(([name, v]) => (
                    <TableRow key={name}>
                      <TableCell>{name}</TableCell>
                      <TableCell className="text-right">{v.qty}</TableCell>
                      <TableCell className="text-right">{fmtMoney(v.total, sym)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <EmptyHint text="No sales recorded yet." />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Low Stock Items</CardTitle></CardHeader>
        <CardContent>
          {inv.data?.lowStock.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Min</TableHead><TableHead>Unit</TableHead></TableRow></TableHeader>
              <TableBody>
                {inv.data.lowStock.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right"><Badge variant={Number(p.stock_quantity) === 0 ? "destructive" : "outline"}>{p.stock_quantity}</Badge></TableCell>
                    <TableCell className="text-right">{p.min_stock}</TableCell>
                    <TableCell>{p.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <EmptyHint text="All stock levels are healthy." />}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>;
}
