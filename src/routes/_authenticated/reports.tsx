import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtMoney, useSettings } from "@/lib/settings";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

function ReportsPage() {
  const settings = useSettings();
  const sym = settings.currency_symbol;

  const [from, setFrom] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const sales = useQuery({
    queryKey: ["report-sales", from, to],
    queryFn: async () => {
      const fromIso = startOfDay(new Date(from)).toISOString();
      const toIso = endOfDay(new Date(to)).toISOString();
      const { data } = await supabase.from("sales").select("*,sale_items(*,products(categories(name)))").eq("status","completed").gte("created_at", fromIso).lte("created_at", toIso).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const products = useQuery({ queryKey: ["report-products"], queryFn: async () => (await supabase.from("products").select("id,name,stock_quantity,min_stock,purchase_price,selling_price,unit,categories(name)")).data ?? [] });

  const stats = useMemo(() => {
    const list = sales.data ?? [];
    let totalSales = 0, profit = 0;
    const byDay = new Map<string, { sales: number; profit: number }>();
    const byProduct = new Map<string, { qty: number; total: number }>();
    const byCategory = new Map<string, { total: number }>();
    const byCashier = new Map<string, { sales: number; orders: number }>();

    for (const s of list as any[]) {
      totalSales += Number(s.total);
      const day = format(new Date(s.created_at), "MMM d");
      const cur = byDay.get(day) ?? { sales: 0, profit: 0 };
      cur.sales += Number(s.total);
      let saleProfit = 0;
      for (const it of (s.sale_items as any[]) ?? []) {
        saleProfit += (Number(it.unit_price) - Number(it.purchase_price)) * Number(it.quantity);
        const p = byProduct.get(it.product_name) ?? { qty: 0, total: 0 };
        p.qty += Number(it.quantity); p.total += Number(it.total); byProduct.set(it.product_name, p);
        const catName = it.products?.categories?.name ?? "Uncategorised";
        const c = byCategory.get(catName) ?? { total: 0 };
        c.total += Number(it.total); byCategory.set(catName, c);
      }
      profit += saleProfit;
      cur.profit += saleProfit;
      byDay.set(day, cur);
      const cashName = s.cashier_name ?? "Unknown";
      const ca = byCashier.get(cashName) ?? { sales: 0, orders: 0 };
      ca.sales += Number(s.total); ca.orders += 1; byCashier.set(cashName, ca);
    }
    const chart = [...byDay.entries()].map(([day, v]) => ({ day, sales: v.sales, profit: v.profit }));
    return {
      totalSales, profit, orders: list.length, chart,
      byProduct: [...byProduct.entries()].sort((a,b)=>b[1].total-a[1].total).slice(0,20),
      byCategory: [...byCategory.entries()].sort((a,b)=>b[1].total-a[1].total),
      byCashier: [...byCashier.entries()].sort((a,b)=>b[1].sales-a[1].sales),
    };
  }, [sales.data]);

  const inventoryValue = (products.data ?? []).reduce((a: number, p: any) => a + Number(p.purchase_price) * Number(p.stock_quantity), 0);
  const lowStock = (products.data ?? []).filter((p: any) => Number(p.stock_quantity) <= Number(p.min_stock));

  const exportCsv = (rows: any[], filename: string) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g,'""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Reports</h1><p className="text-sm text-muted-foreground">Sales, inventory and performance</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e=>setTo(e.target.value)} /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Sales" value={fmtMoney(stats.totalSales, sym)} />
        <Stat label="Total Profit" value={fmtMoney(stats.profit, sym)} />
        <Stat label="Orders" value={String(stats.orders)} />
        <Stat label="Inventory Value" value={fmtMoney(inventoryValue, sym)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Sales & Profit Trend</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" /><YAxis />
              <Tooltip formatter={(v: any) => fmtMoney(v, sym)} />
              <Bar dataKey="sales" name="Sales" fill="hsl(217 91% 60%)" />
              <Bar dataKey="profit" name="Profit" fill="hsl(142 71% 45%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Tabs defaultValue="products">
        <TabsList className="flex-wrap">
          <TabsTrigger value="products">By Product</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="cashiers">By Cashier</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="low">Low Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card><CardContent className="p-3 sm:p-4">
            <div className="mb-2 flex justify-end"><Button size="sm" variant="outline" onClick={()=>exportCsv(stats.byProduct.map(([name,v])=>({ name, qty: v.qty, total: v.total })), "products.csv")}><Download className="mr-1 h-4 w-4" />CSV</Button></div>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {stats.byProduct.length === 0 && <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">No sales in range.</TableCell></TableRow>}
                {stats.byProduct.map(([name, v]) => <TableRow key={name}><TableCell>{name}</TableCell><TableCell className="text-right">{v.qty}</TableCell><TableCell className="text-right tabular-nums">{fmtMoney(v.total, sym)}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card><CardContent className="p-3 sm:p-4">
            <Table>
              <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {stats.byCategory.length === 0 && <TableRow><TableCell colSpan={2} className="py-10 text-center text-muted-foreground">No sales in range.</TableCell></TableRow>}
                {stats.byCategory.map(([n, v]) => <TableRow key={n}><TableCell>{n}</TableCell><TableCell className="text-right tabular-nums">{fmtMoney(v.total, sym)}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cashiers">
          <Card><CardContent className="p-3 sm:p-4">
            <Table>
              <TableHeader><TableRow><TableHead>Cashier</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Sales</TableHead></TableRow></TableHeader>
              <TableBody>
                {stats.byCashier.length === 0 && <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">No sales in range.</TableCell></TableRow>}
                {stats.byCashier.map(([n, v]) => <TableRow key={n}><TableCell>{n}</TableCell><TableCell className="text-right">{v.orders}</TableCell><TableCell className="text-right tabular-nums">{fmtMoney(v.sales, sym)}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card><CardContent className="p-3 sm:p-4">
            <div className="mb-2 flex justify-end"><Button size="sm" variant="outline" onClick={()=>exportCsv((products.data ?? []).map((p: any)=>({ name: p.name, stock: p.stock_quantity, unit: p.unit, purchase: p.purchase_price, selling: p.selling_price, value: Number(p.stock_quantity)*Number(p.purchase_price) })), "inventory.csv")}><Download className="mr-1 h-4 w-4" />CSV</Button></div>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
              <TableBody>
                {(products.data ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell><TableCell className="text-right">{p.stock_quantity} {p.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(p.purchase_price, sym)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(Number(p.stock_quantity) * Number(p.purchase_price), sym)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="low">
          <Card><CardContent className="p-3 sm:p-4">
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Min</TableHead></TableRow></TableHeader>
              <TableBody>
                {lowStock.length === 0 && <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">All stock healthy.</TableCell></TableRow>}
                {lowStock.map((p: any) => <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell className="text-right">{p.stock_quantity} {p.unit}</TableCell><TableCell className="text-right">{p.min_stock}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="pt-5"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-bold tabular-nums">{value}</div></CardContent></Card>;
}
