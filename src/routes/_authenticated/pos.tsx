import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Minus, Trash2, ShoppingCart, Pause, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney, useSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/pos")({ component: POS });

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  purchase_price: number;
  discount: number;
  stock: number;
}

const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "EasyPaisa", "JazzCash"];

function POS() {
  const settings = useSettings();
  const { user, fullName } = useAuth();
  const qc = useQueryClient();
  const sym = settings.currency_symbol;

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(settings.tax_percent);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState("Cash");
  const [customerId, setCustomerId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTaxPercent(settings.tax_percent), [settings.tax_percent]);

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,name,sku,barcode,selling_price,purchase_price,stock_quantity,unit").eq("is_active", true).order("name");
      return data ?? [];
    },
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => {
      const { data } = await supabase.rpc("pos_list_customers");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (customers.length && !customerId) {
      const walk = customers.find((c: any) => c.is_walk_in);
      setCustomerId(walk?.id ?? customers[0].id);
    }
  }, [customers, customerId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return (products as any[]).filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q) ||
      (p.barcode || "").toLowerCase().includes(q)
    ).slice(0, 40);
  }, [products, search]);

  const addToCart = (p: any) => {
    if (Number(p.stock_quantity) <= 0) return toast.error(`${p.name} is out of stock`);
    setCart(prev => {
      const i = prev.findIndex(c => c.product_id === p.id);
      if (i >= 0) {
        const next = [...prev];
        if (next[i].quantity + 1 > Number(p.stock_quantity)) {
          toast.error("Not enough stock"); return prev;
        }
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, {
        product_id: p.id, product_name: p.name, quantity: 1,
        unit_price: Number(p.selling_price), purchase_price: Number(p.purchase_price),
        discount: 0, stock: Number(p.stock_quantity),
      }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.flatMap(c => {
      if (c.product_id !== id) return [c];
      const q = c.quantity + delta;
      if (q <= 0) return [];
      if (q > c.stock) { toast.error("Not enough stock"); return [c]; }
      return [{ ...c, quantity: q }];
    }));
  };
  const setQty = (id: string, q: number) => {
    setCart(prev => prev.map(c => {
      if (c.product_id !== id) return c;
      const nq = Math.max(0, Math.min(q, c.stock));
      return { ...c, quantity: nq };
    }).filter(c => c.quantity > 0));
  };
  const setItemDiscount = (id: string, d: number) =>
    setCart(prev => prev.map(c => c.product_id === id ? { ...c, discount: Math.max(0, d) } : c));
  const removeItem = (id: string) => setCart(prev => prev.filter(c => c.product_id !== id));

  const itemSubtotals = cart.map(c => c.quantity * c.unit_price - c.discount);
  const subtotal = itemSubtotals.reduce((a, b) => a + b, 0);
  const afterBillDiscount = Math.max(0, subtotal - billDiscount);
  const tax = afterBillDiscount * (Number(taxPercent) / 100);
  const total = afterBillDiscount + tax;
  const change = Math.max(0, paid - total);

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filtered.length) {
      addToCart(filtered[0]);
      setSearch("");
    }
  };

  const reset = () => {
    setCart([]); setBillDiscount(0); setPaid(0);
    setTaxPercent(settings.tax_percent); setMethod("Cash");
    searchRef.current?.focus();
  };

  const complete = async (status: "completed" | "held") => {
    if (!cart.length) return toast.error("Cart is empty");
    if (status === "completed" && paid < total) return toast.error("Paid amount is less than total");
    setBusy(true);
    const payload = {
      customer_id: customerId,
      cashier_name: fullName || user?.email,
      subtotal,
      discount: billDiscount + cart.reduce((a, c) => a + c.discount, 0),
      tax,
      total,
      paid: status === "completed" ? paid : 0,
      change_due: status === "completed" ? change : 0,
      payment_method: method,
      status,
      items: cart.map(c => ({
        product_id: c.product_id, product_name: c.product_name,
        quantity: c.quantity, unit_price: c.unit_price,
        purchase_price: c.purchase_price, discount: c.discount,
        total: c.quantity * c.unit_price - c.discount,
      })),
    };
    const { data, error } = await supabase.rpc("process_sale", { payload });
    setBusy(false);
    if (error) return toast.error(error.message);

    if (status === "completed") {
      toast.success("Sale completed");
      await printReceipt(data as string);
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["dash-today"] });
      qc.invalidateQueries({ queryKey: ["dash-inv"] });
    } else {
      toast.success("Order held");
    }
    reset();
  };

  const printReceipt = async (saleId: string) => {
    const { data: sale } = await supabase.from("sales").select("*,sale_items(*)").eq("id", saleId).maybeSingle();
    if (!sale) return;
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) return;
    const itemsHtml = (sale.sale_items as any[]).map(i =>
      `<tr><td>${i.product_name}<br/><span style="font-size:10px;color:#666">${i.quantity} × ${sym} ${Number(i.unit_price).toFixed(2)}${Number(i.discount)?` − ${sym} ${Number(i.discount).toFixed(2)}`:''}</span></td><td style="text-align:right">${sym} ${Number(i.total).toFixed(2)}</td></tr>`
    ).join("");
    w.document.write(`<!doctype html><html><head><title>Receipt ${sale.invoice_no}</title>
<style>body{font-family:ui-monospace,Menlo,monospace;font-size:12px;padding:12px;color:#000}
h2,h3{margin:4px 0;text-align:center}table{width:100%;border-collapse:collapse}
td{padding:4px 0;vertical-align:top;border-bottom:1px dashed #ddd}
.tot td{font-weight:bold;border-bottom:none;border-top:2px solid #000}
.row{display:flex;justify-content:space-between;padding:2px 0}
.muted{color:#555;font-size:10px;text-align:center}</style></head><body>
${settings.store_logo_url ? `<div style="text-align:center"><img src="${settings.store_logo_url}" alt="" style="max-height:50px;margin:0 auto 4px"/></div>` : ""}
<h2>${settings.store_name}</h2>
<div class="muted">${settings.store_address ?? ""}</div>
<div class="muted">${settings.store_phone ? "Tel: "+settings.store_phone : ""}${settings.store_phone && settings.store_email ? " · " : ""}${settings.store_email ?? ""}</div>

<hr/>
<div class="row"><span>Invoice:</span><span>${sale.invoice_no}</span></div>
<div class="row"><span>Date:</span><span>${new Date(sale.created_at).toLocaleString()}</span></div>
<div class="row"><span>Cashier:</span><span>${sale.cashier_name ?? ""}</span></div>
<div class="row"><span>Payment:</span><span>${sale.payment_method}</span></div>
<table>${itemsHtml}</table>
<div class="row"><span>Subtotal</span><span>${sym} ${Number(sale.subtotal).toFixed(2)}</span></div>
<div class="row"><span>Discount</span><span>− ${sym} ${Number(sale.discount).toFixed(2)}</span></div>
<div class="row"><span>Tax</span><span>${sym} ${Number(sale.tax).toFixed(2)}</span></div>
<table class="tot"><tr><td>TOTAL</td><td style="text-align:right">${sym} ${Number(sale.total).toFixed(2)}</td></tr></table>
<div class="row"><span>Paid</span><span>${sym} ${Number(sale.paid).toFixed(2)}</span></div>
<div class="row"><span>Change</span><span>${sym} ${Number(sale.change_due).toFixed(2)}</span></div>
<hr/><div class="muted">${settings.receipt_footer ?? ""}</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    w.document.close();
  };

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 items-stretch gap-3 lg:grid-cols-5">
      {/* Products */}
      <div className="flex h-full min-h-0 flex-col gap-3 lg:col-span-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            autoFocus
            placeholder="Search by name, SKU or scan barcode…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={onSearchKey}
            className="pl-9"
          />
        </div>
        <div className="grid flex-1 auto-rows-min grid-cols-2 content-start gap-2 overflow-auto rounded-lg border bg-background p-2 sm:grid-cols-3 md:grid-cols-4">
          {filtered.length === 0 && (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">No products found.</div>
          )}
          {filtered.map((p: any) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="flex h-[110px] flex-col rounded-md border bg-card p-2 text-left transition hover:border-primary hover:shadow_main disabled:opacity-50"
              disabled={Number(p.stock_quantity) <= 0}
            >
              <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">SKU: {p.sku ?? "—"}</div>
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="text-sm font-semibold">{fmtMoney(p.selling_price, sym)}</span>
                <Badge variant={Number(p.stock_quantity) <= 0 ? "destructive" : "secondary"} className="text-[10px]">
                  {p.stock_quantity} {p.unit}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <Card className="flex h-full flex-col lg:col-span-2">
        <CardContent className="flex flex-1 flex-col gap-3 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 overflow-auto rounded-md border">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-10 text-muted-foreground">
                <ShoppingCart className="mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">Cart is empty</p>
              </div>
            ) : (
              <div className="divide-y">
                {cart.map(c => (
                  <div key={c.product_id} className="p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{c.product_name}</div>
                        <div className="text-xs text-muted-foreground">{fmtMoney(c.unit_price, sym)}</div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(c.product_id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                      <Input type="number" className="h-7 w-16 text-center" value={c.quantity} onChange={e => setQty(c.product_id, Number(e.target.value) || 0)} />
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                      <Input type="number" placeholder="Disc" className="h-7 w-20 text-right" value={c.discount || ""} onChange={e => setItemDiscount(c.product_id, Number(e.target.value) || 0)} />
                      <div className="ml-auto text-sm font-semibold tabular-nums">{fmtMoney(c.quantity * c.unit_price - c.discount, sym)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5 rounded-md bg-muted/40 p-3 text-sm">
            <Row label="Subtotal" value={fmtMoney(subtotal, sym)} />
            <div className="flex items-center justify-between gap-2">
              <span>Bill Discount</span>
              <Input type="number" className="h-7 w-28 text-right" value={billDiscount || ""} onChange={e => setBillDiscount(Number(e.target.value) || 0)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Tax (%)</span>
              <Input type="number" className="h-7 w-28 text-right" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value) || 0)} />
            </div>
            <Row label="Tax Amount" value={fmtMoney(tax, sym)} />
            <div className="my-1 h-px bg-border" />
            <Row label="TOTAL" value={fmtMoney(total, sym)} bold />
            <div className="flex items-center justify-between gap-2">
              <span>Paid</span>
              <Input type="number" className="h-8 w-32 text-right font-semibold" value={paid || ""} onChange={e => setPaid(Number(e.target.value) || 0)} />
            </div>
            <Row label="Change Due" value={fmtMoney(change, sym)} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" disabled={busy || !cart.length} onClick={() => complete("held")}><Pause className="mr-1 h-4 w-4" />Hold</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={!cart.length}><X className="mr-1 h-4 w-4" />Cancel</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Cancel order?</AlertDialogTitle><AlertDialogDescription>This clears the cart. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Keep</AlertDialogCancel><AlertDialogAction onClick={reset}>Yes, cancel</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button disabled={busy || !cart.length} onClick={() => complete("completed")}>
              <Printer className="mr-1 h-4 w-4" />{busy ? "..." : "Complete"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}
