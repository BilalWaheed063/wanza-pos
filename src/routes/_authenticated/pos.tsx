import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Pause,
  Printer,
  X,
  ScanLine,
  ReceiptText,
  PackageCheck,
  WalletCards,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney, useSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTaxPercent(settings.tax_percent), [settings.tax_percent]);

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,sku,barcode,selling_price,purchase_price,stock_quantity,unit")
        .eq("is_active", true)
        .order("name");
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
    return (products as any[])
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q) ||
          (p.barcode || "").toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [products, search]);

  const addToCart = (p: any) => {
    if (Number(p.stock_quantity) <= 0) return toast.error(`${p.name} is out of stock`);
    setCart((prev) => {
      const i = prev.findIndex((c) => c.product_id === p.id);
      if (i >= 0) {
        const next = [...prev];
        if (next[i].quantity + 1 > Number(p.stock_quantity)) {
          toast.error("Not enough stock");
          return prev;
        }
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          product_id: p.id,
          product_name: p.name,
          quantity: 1,
          unit_price: Number(p.selling_price),
          purchase_price: Number(p.purchase_price),
          discount: 0,
          stock: Number(p.stock_quantity),
        },
      ];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((c) => {
        if (c.product_id !== id) return [c];
        const q = c.quantity + delta;
        if (q <= 0) return [];
        if (q > c.stock) {
          toast.error("Not enough stock");
          return [c];
        }
        return [{ ...c, quantity: q }];
      }),
    );
  };
  const setQty = (id: string, q: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product_id !== id) return c;
          const nq = Math.max(0, Math.min(q, c.stock));
          return { ...c, quantity: nq };
        })
        .filter((c) => c.quantity > 0),
    );
  };
  const setItemDiscount = (id: string, d: number) =>
    setCart((prev) =>
      prev.map((c) => (c.product_id === id ? { ...c, discount: Math.max(0, d) } : c)),
    );
  const removeItem = (id: string) => setCart((prev) => prev.filter((c) => c.product_id !== id));

  const cartQuantity = cart.reduce((a, c) => a + c.quantity, 0);
  const itemSubtotals = cart.map((c) => c.quantity * c.unit_price - c.discount);
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
    setCart([]);
    setBillDiscount(0);
    setPaid(0);
    setTaxPercent(settings.tax_percent);
    setMethod("Cash");
    searchRef.current?.focus();
  };

  const complete = async (status: "completed" | "held") => {
    if (!cart.length) return toast.error("Cart is empty");
    if (status === "completed" && paid < total)
      return toast.error("Paid amount is less than total");
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
      items: cart.map((c) => ({
        product_id: c.product_id,
        product_name: c.product_name,
        quantity: c.quantity,
        unit_price: c.unit_price,
        purchase_price: c.purchase_price,
        discount: c.discount,
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
    const { data: sale } = await supabase
      .from("sales")
      .select("*,sale_items(*)")
      .eq("id", saleId)
      .maybeSingle();
    if (!sale) return;
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) return;
    const itemsHtml = (sale.sale_items as any[])
      .map(
        (i) =>
          `<tr><td>${i.product_name}<br/><span style="font-size:10px;color:#666">${i.quantity} × ${sym} ${Number(i.unit_price).toFixed(2)}${Number(i.discount) ? ` − ${sym} ${Number(i.discount).toFixed(2)}` : ""}</span></td><td style="text-align:right">${sym} ${Number(i.total).toFixed(2)}</td></tr>`,
      )
      .join("");
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
<div class="muted">${settings.store_phone ? "Tel: " + settings.store_phone : ""}${settings.store_phone && settings.store_email ? " · " : ""}${settings.store_email ?? ""}</div>

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
    <div className="-m-1 h-[calc(100vh-8.5rem)] min-h-[720px] overflow-hidden xl:-m-2">
      <div className="grid h-full min-h-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* Products */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 shadow-[0_24px_70px_oklch(0.188_0.035_260.13_/_9%)] backdrop-blur">
          <div className="border-b border-border/70 bg-gradient-to-br from-card via-card to-muted/45 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary/70">
                  Product selection
                </div>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-foreground">
                  Choose items for checkout
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filtered.length} shown from {products.length} active products
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-2 text-sm font-bold text-primary">
                  <PackageCheck className="h-4 w-4" />
                  {cartQuantity} items
                </div>
                <Sheet open={cartDrawerOpen} onOpenChange={setCartDrawerOpen}>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="relative h-10 rounded-full border-primary/20 bg-card px-4 font-extrabold text-primary shadow-sm hover:bg-primary hover:text-primary-foreground"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      View cart
                      {cartQuantity > 0 && (
                        <span className="ml-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-black text-primary-foreground group-hover:bg-primary-foreground group-hover:text-primary">
                          {cartQuantity}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <CartDrawerContent
                    cart={cart}
                    sym={sym}
                    subtotal={subtotal}
                    total={total}
                    billDiscount={billDiscount}
                    tax={tax}
                    busy={busy}
                    updateQty={updateQty}
                    setQty={setQty}
                    setItemDiscount={setItemDiscount}
                    removeItem={removeItem}
                    reset={reset}
                    complete={complete}
                    closeDrawer={() => setCartDrawerOpen(false)}
                  />
                </Sheet>
              </div>
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                autoFocus
                placeholder="Search by name, SKU or scan barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKey}
                className="h-13 rounded-2xl border-border/80 bg-background/85 pl-11 pr-4 text-[15px] shadow-inner outline-none transition focus-visible:ring-2 focus-visible:ring-primary/25"
              />
              <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-border/60 bg-muted/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:flex">
                <ScanLine className="h-3.5 w-3.5" /> Scan ready
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
            {filtered.length === 0 ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                <Search className="mb-3 h-8 w-8 opacity-45" />
                <p className="font-semibold text-foreground">No products found</p>
                <p className="mt-1">Try another name, SKU or barcode.</p>
              </div>
            ) : (
              <div className="grid auto-rows-fr grid-cols-2 content-start gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {filtered.map((p: any) => {
                  const stock = Number(p.stock_quantity);
                  const isOut = stock <= 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="group relative flex h-[148px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border/75 bg-gradient-to-br from-background via-background to-muted/45 p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_18px_45px_oklch(0.188_0.035_260.13_/_10%)] disabled:cursor-not-allowed disabled:opacity-55"
                      disabled={isOut}
                    >
                      <div className="absolute right-3 top-3 h-8 w-8 rounded-full bg-primary/5 opacity-0 transition group-hover:opacity-100" />
                      <div className="relative min-w-0">
                        <div className="line-clamp-2 min-h-[38px] text-[13px] font-extrabold leading-snug tracking-[-0.01em] text-foreground">
                          {p.name}
                        </div>
                        <div className="mt-1 truncate text-[11px] font-semibold text-muted-foreground">
                          SKU: {p.sku ?? "—"}
                        </div>
                      </div>
                      <div className="relative mt-auto flex items-end justify-between gap-2 pt-3">
                        <span className="min-w-0 text-[15px] font-black leading-none tracking-tight text-foreground">
                          {fmtMoney(p.selling_price, sym)}
                        </span>
                        <Badge
                          variant={isOut ? "destructive" : "secondary"}
                          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold"
                        >
                          {isOut ? "0 stock" : `${p.stock_quantity} ${p.unit}`}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Cart */}
        <Card className="flex min-h-0 overflow-hidden rounded-[2rem] border-border/70 bg-card/95 shadow-[0_24px_70px_oklch(0.188_0.035_260.13_/_10%)] backdrop-blur">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5">
            <div className="rounded-[1.5rem] border border-border/70 bg-gradient-to-br from-muted/45 via-background to-background p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary/70">
                    <ReceiptText className="h-3.5 w-3.5" /> Checkout
                  </div>
                  <h2 className="mt-1 text-lg font-black tracking-tight">Current sale</h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full px-3 text-xs font-extrabold"
                  onClick={() => setCartDrawerOpen(true)}
                >
                  <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                  {cart.length} lines
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Customer
                  </Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger className="h-11 rounded-2xl bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Payment
                  </Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="h-11 rounded-2xl bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/75">
              {cart.length === 0 ? (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center bg-[radial-gradient(circle_at_center,oklch(0.94_0.034_259.89_/_55%),transparent_20rem)] p-8 text-center text-muted-foreground">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-sm">
                    <ShoppingCart className="h-7 w-7 opacity-55" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Cart is empty</p>
                  <p className="mt-1 max-w-[220px] text-xs leading-relaxed">
                    Click any product card or scan a barcode to add it here.
                  </p>
                </div>
              ) : (
                <div className="h-full overflow-auto p-2">
                  <div className="space-y-2">
                    {cart.map((c) => (
                      <div
                        key={c.product_id}
                        className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-extrabold tracking-[-0.01em]">
                              {c.product_name}
                            </div>
                            <div className="mt-0.5 text-xs font-semibold text-muted-foreground">
                              {fmtMoney(c.unit_price, sym)} each
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removeItem(c.product_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="mt-3 grid grid-cols-[auto_4rem_auto_4.75rem_minmax(0,1fr)] items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-full"
                            onClick={() => updateQty(c.product_id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            className="h-8 rounded-xl text-center text-sm font-bold"
                            value={c.quantity}
                            onChange={(e) => setQty(c.product_id, Number(e.target.value) || 0)}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-full"
                            onClick={() => updateQty(c.product_id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            placeholder="Disc"
                            className="h-8 rounded-xl text-right text-sm"
                            value={c.discount || ""}
                            onChange={(e) =>
                              setItemDiscount(c.product_id, Number(e.target.value) || 0)
                            }
                          />
                          <div className="truncate text-right text-sm font-black tabular-nums">
                            {fmtMoney(c.quantity * c.unit_price - c.discount, sym)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-[1.5rem] border border-border/70 bg-muted/35 p-4 text-sm shadow-inner">
              <Row label="Subtotal" value={fmtMoney(subtotal, sym)} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Bill Discount</span>
                <Input
                  type="number"
                  className="h-8 w-28 rounded-xl text-right font-semibold"
                  value={billDiscount || ""}
                  onChange={(e) => setBillDiscount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Tax (%)</span>
                <Input
                  type="number"
                  className="h-8 w-28 rounded-xl text-right font-semibold"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(Number(e.target.value) || 0)}
                />
              </div>
              <Row label="Tax Amount" value={fmtMoney(tax, sym)} />
              <div className="my-2 h-px bg-border" />
              <div className="rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-lg shadow-primary/15">
                <Row label="TOTAL" value={fmtMoney(total, sym)} bold />
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <WalletCards className="h-4 w-4" /> Paid
                </span>
                <Input
                  type="number"
                  className="h-9 w-32 rounded-xl text-right text-base font-black"
                  value={paid || ""}
                  onChange={(e) => setPaid(Number(e.target.value) || 0)}
                />
              </div>
              <Row label="Change Due" value={fmtMoney(change, sym)} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="h-11 rounded-2xl font-bold"
                disabled={busy || !cart.length}
                onClick={() => complete("held")}
              >
                <Pause className="mr-1.5 h-4 w-4" />
                Hold
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 rounded-2xl font-bold"
                    disabled={!cart.length}
                  >
                    <X className="mr-1.5 h-4 w-4" />
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel order?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This clears the cart. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction onClick={reset}>Yes, cancel</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                className="h-11 rounded-2xl font-black shadow-lg shadow-primary/20"
                disabled={busy || !cart.length}
                onClick={() => complete("completed")}
              >
                <Printer className="mr-1.5 h-4 w-4" />
                {busy ? "..." : "Complete"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CartDrawerContent({
  cart,
  sym,
  subtotal,
  total,
  billDiscount,
  tax,
  busy,
  updateQty,
  setQty,
  setItemDiscount,
  removeItem,
  reset,
  complete,
  closeDrawer,
}: {
  cart: CartItem[];
  sym: string;
  subtotal: number;
  total: number;
  billDiscount: number;
  tax: number;
  busy: boolean;
  updateQty: (id: string, delta: number) => void;
  setQty: (id: string, q: number) => void;
  setItemDiscount: (id: string, d: number) => void;
  removeItem: (id: string) => void;
  reset: () => void;
  complete: (status: "completed" | "held") => Promise<void>;
  closeDrawer: () => void;
}) {
  const cartQuantity = cart.reduce((a, c) => a + c.quantity, 0);

  return (
    <SheetContent className="flex w-[94vw] max-w-none flex-col overflow-hidden border-l border-border/70 bg-background p-0 sm:w-[460px] sm:max-w-[460px]">
      <SheetHeader className="border-b border-border/70 bg-gradient-to-br from-card via-card to-muted/45 p-5 pr-12 text-left">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
              <ShoppingCart className="h-3.5 w-3.5" /> Live cart
            </div>
            <SheetTitle className="text-2xl font-black tracking-tight">Cart items</SheetTitle>
            <SheetDescription>
              Update quantities, discounts or remove products without leaving the POS screen.
            </SheetDescription>
          </div>
          <div className="mt-1 rounded-2xl border border-border/70 bg-card px-3 py-2 text-center shadow-sm">
            <div className="text-xl font-black tabular-nums text-primary">{cartQuantity}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Items
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/25 p-4">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-border/70 bg-muted/50">
              <ShoppingCart className="h-8 w-8 opacity-55" />
            </div>
            <p className="text-base font-black text-foreground">No items added yet</p>
            <p className="mt-1 max-w-[260px] text-sm leading-relaxed">
              Add products from the left grid, then open this drawer to manage cart items.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((c) => (
              <div
                key={c.product_id}
                className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-card shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-background to-muted/45 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-black leading-snug tracking-[-0.01em] text-foreground">
                      {c.product_name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <span>{fmtMoney(c.unit_price, sym)} each</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                      <span>{c.stock} available</span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeItem(c.product_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3 p-4">
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-10 w-10 rounded-full"
                      onClick={() => updateQty(c.product_id, -1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      max={c.stock}
                      className="h-10 rounded-2xl text-center text-base font-black"
                      value={c.quantity}
                      onChange={(e) => setQty(c.product_id, Number(e.target.value) || 0)}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-10 w-10 rounded-full"
                      onClick={() => updateQty(c.product_id, 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-[1fr_7rem] items-center gap-3">
                    <div>
                      <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        Line discount
                      </Label>
                      <Input
                        type="number"
                        placeholder="0"
                        className="mt-1 h-10 rounded-2xl text-right font-bold"
                        value={c.discount || ""}
                        onChange={(e) => setItemDiscount(c.product_id, Number(e.target.value) || 0)}
                      />
                    </div>
                    <div className="rounded-2xl border border-primary/15 bg-primary/8 p-3 text-right">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary/70">
                        Line total
                      </div>
                      <div className="mt-1 text-sm font-black tabular-nums text-primary">
                        {fmtMoney(c.quantity * c.unit_price - c.discount, sym)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border/70 bg-card p-4 shadow-[0_-18px_45px_oklch(0.188_0.035_260.13_/_8%)]">
        <div className="space-y-2 rounded-[1.35rem] border border-border/70 bg-muted/35 p-4 text-sm">
          <Row label="Subtotal" value={fmtMoney(subtotal, sym)} />
          <Row label="Bill Discount" value={`− ${fmtMoney(billDiscount, sym)}`} />
          <Row label="Tax Amount" value={fmtMoney(tax, sym)} />
          <div className="my-2 h-px bg-border" />
          <div className="rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-lg shadow-primary/15">
            <Row label="TOTAL" value={fmtMoney(total, sym)} bold />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-2xl font-bold"
            onClick={closeDrawer}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-2xl font-bold"
            disabled={busy || !cart.length}
            onClick={() => complete("held")}
          >
            Hold
          </Button>
          <Button
            type="button"
            className="h-11 rounded-2xl font-black shadow-lg shadow-primary/20"
            disabled={busy || !cart.length}
            onClick={() => complete("completed")}
          >
            {busy ? "..." : "Complete"}
          </Button>
        </div>

        {cart.length > 0 && (
          <button
            type="button"
            className="mt-3 w-full text-center text-xs font-bold text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
            onClick={reset}
          >
            Clear all cart items
          </button>
        )}
      </div>
    </SheetContent>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${bold ? "text-base font-black" : ""}`}
    >
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
