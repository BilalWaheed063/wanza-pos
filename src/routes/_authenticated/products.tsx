import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { fmtMoney, useSettings } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/products")({ component: ProductsPage });

const UNITS = ["piece","box","kg","gram","liter","ml","pack"];

interface Product {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  category_id: string | null;
  brand: string;
  supplier_id: string | null;
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock: number;
  unit: string;
  expiry_date: string | null;
  is_active: boolean;
}

const empty: Product = {
  name: "", sku: "", barcode: "", category_id: null, brand: "", supplier_id: null,
  purchase_price: 0, selling_price: 0, stock_quantity: 0, min_stock: 0,
  unit: "piece", expiry_date: null, is_active: true,
};

function ProductsPage() {
  const settings = useSettings();
  const sym = settings.currency_symbol;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product>(empty);

  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*,categories(name),suppliers(name)").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const cats = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("categories").select("id,name").order("name")).data ?? [] });
  const sups = useQuery({ queryKey: ["suppliers-min"], queryFn: async () => (await supabase.from("suppliers").select("id,name").order("name")).data ?? [] });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (products.data ?? []).filter((p: any) => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || (p.sku||"").toLowerCase().includes(q) || (p.barcode||"").toLowerCase().includes(q);
      if (!matchQ) return false;
      if (filter === "low") return Number(p.stock_quantity) <= Number(p.min_stock) && Number(p.stock_quantity) > 0;
      if (filter === "out") return Number(p.stock_quantity) <= 0;
      return true;
    });
  }, [products.data, search, filter]);

  const save = useMutation({
    mutationFn: async (p: Product) => {
      const payload = { ...p, sku: p.sku || null, barcode: p.barcode || null, expiry_date: p.expiry_date || null };
      if (p.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["products"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("products").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(empty); setOpen(true); };
  const openEdit = (p: any) => { setEditing({ ...p, category_id: p.category_id ?? null, supplier_id: p.supplier_id ?? null }); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
        <div><h1 className="text-2xl font-bold tracking-tight">Products</h1><p className="text-sm text-muted-foreground">Manage your inventory</p></div>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" />Add Product</Button>
      </div>

      <Card><CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search products…" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={v=>setFilter(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="low">Low stock</SelectItem>
              <SelectItem value="out">Out of stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead>
              <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Price</TableHead>
              <TableHead>Status</TableHead><TableHead className="w-24"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {products.isLoading && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!products.isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No products. Click "Add Product" to start.</TableCell></TableRow>}
              {filtered.map((p: any) => {
                const out = Number(p.stock_quantity) <= 0;
                const low = !out && Number(p.stock_quantity) <= Number(p.min_stock);
                return (
                  <TableRow key={p.id} className={low ? "bg-amber-50/40" : out ? "bg-destructive/5" : ""}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.brand && <div className="text-xs text-muted-foreground">{p.brand}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku ?? "—"}</TableCell>
                    <TableCell>{p.categories?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={out ? "destructive" : low ? "outline" : "secondary"}>
                        {p.stock_quantity} {p.unit}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(p.selling_price, sym)}</TableCell>
                    <TableCell>{p.is_active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete product?</AlertDialogTitle><AlertDialogDescription>{p.name} will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(p.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing.id ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          <form onSubmit={e=>{e.preventDefault(); if (!editing.name.trim()) return toast.error("Name is required"); save.mutate(editing);}}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name *"><Input required value={editing.name} onChange={e=>setEditing({...editing, name:e.target.value})} /></Field>
              <Field label="Brand"><Input value={editing.brand} onChange={e=>setEditing({...editing, brand:e.target.value})} /></Field>
              <Field label="SKU"><Input value={editing.sku} onChange={e=>setEditing({...editing, sku:e.target.value})} /></Field>
              <Field label="Barcode"><Input value={editing.barcode} onChange={e=>setEditing({...editing, barcode:e.target.value})} /></Field>
              <Field label="Category">
                <Select value={editing.category_id ?? "none"} onValueChange={v=>setEditing({...editing, category_id: v === "none" ? null : v})}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {(cats.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Supplier">
                <Select value={editing.supplier_id ?? "none"} onValueChange={v=>setEditing({...editing, supplier_id: v === "none" ? null : v})}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {(sups.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Unit">
                <Select value={editing.unit} onValueChange={v=>setEditing({...editing, unit:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u=> <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Expiry date"><Input type="date" value={editing.expiry_date ?? ""} onChange={e=>setEditing({...editing, expiry_date: e.target.value || null})} /></Field>
              <Field label={`Purchase price (${sym})`}><Input type="number" step="0.01" value={editing.purchase_price} onChange={e=>setEditing({...editing, purchase_price: Number(e.target.value)})} /></Field>
              <Field label={`Selling price (${sym})`}><Input type="number" step="0.01" value={editing.selling_price} onChange={e=>setEditing({...editing, selling_price: Number(e.target.value)})} /></Field>
              <Field label="Stock quantity"><Input type="number" step="0.001" value={editing.stock_quantity} onChange={e=>setEditing({...editing, stock_quantity: Number(e.target.value)})} /></Field>
              <Field label="Min stock alert"><Input type="number" step="0.001" value={editing.min_stock} onChange={e=>setEditing({...editing, min_stock: Number(e.target.value)})} /></Field>
              <div className="flex items-center gap-2 pt-6 sm:col-span-2">
                <Switch checked={editing.is_active} onCheckedChange={v=>setEditing({...editing, is_active: v})} />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
