import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtMoney, useSettings } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/purchases")({ component: PurchasesPage });

interface PItem { product_id: string; product_name: string; quantity: number; unit_cost: number; }

function PurchasesPage() {
  const settings = useSettings();
  const sym = settings.currency_symbol;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => (await supabase.from("purchases").select("*,suppliers(name),purchase_items(quantity)").order("created_at", { ascending: false })).data ?? [],
  });
  const products = useQuery({ queryKey: ["products-min"], queryFn: async () => (await supabase.from("products").select("id,name,purchase_price,unit").order("name")).data ?? [] });
  const suppliers = useQuery({ queryKey: ["suppliers-min"], queryFn: async () => (await supabase.from("suppliers").select("id,name").order("name")).data ?? [] });

  const [supplierId, setSupplierId] = useState<string>("");
  const [items, setItems] = useState<PItem[]>([]);
  const [paid, setPaid] = useState(0);

  const total = items.reduce((a, i) => a + i.quantity * i.unit_cost, 0);
  const payStatus = paid >= total && total > 0 ? "paid" : paid <= 0 ? "unpaid" : "partial";

  const reset = () => { setItems([]); setPaid(0); setSupplierId(""); };

  const addItem = (pid: string) => {
    const p = (products.data ?? []).find((x: any) => x.id === pid); if (!p) return;
    if (items.find(i => i.product_id === pid)) return;
    setItems([...items, { product_id: pid, product_name: (p as any).name, quantity: 1, unit_cost: Number((p as any).purchase_price) }]);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        supplier_id: supplierId || null,
        total, paid, payment_status: payStatus,
        items: items.map(i => ({ ...i, total: i.quantity * i.unit_cost })),
      };
      const { error } = await supabase.rpc("process_purchase", { payload });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Purchase recorded, stock updated"); qc.invalidateQueries({ queryKey: ["purchases"] }); qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["pos-products"] }); reset(); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
        <div><h1 className="text-2xl font-bold tracking-tight">Purchases</h1><p className="text-sm text-muted-foreground">Stock-in records</p></div>
        <Button onClick={() => { reset(); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />New Purchase</Button>
      </div>
      <Card><CardContent className="p-4 sm:p-5">
        <div className="overflow-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Ref</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {(list.data ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No purchases yet.</TableCell></TableRow>}
            {(list.data ?? []).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.reference_no}</TableCell>
                <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{p.suppliers?.name ?? "—"}</TableCell>
                <TableCell>{(p.purchase_items as any[])?.length ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtMoney(p.total, sym)}</TableCell>
                <TableCell><Badge variant={p.payment_status==='paid'?'secondary':p.payment_status==='partial'?'outline':'destructive'}>{p.payment_status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>New Purchase</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{(suppliers.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Add product</Label>
              <Select value="" onValueChange={addItem}>
                <SelectTrigger><SelectValue placeholder="Pick a product…" /></SelectTrigger>
                <SelectContent>{(products.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="w-24">Qty</TableHead><TableHead className="w-32">Unit cost</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {items.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Add products above</TableCell></TableRow>}
                {items.map((it, i) => (
                  <TableRow key={it.product_id}>
                    <TableCell>{it.product_name}</TableCell>
                    <TableCell><Input type="number" step="0.001" value={it.quantity} onChange={e => { const n=[...items]; n[i] = {...it, quantity: Number(e.target.value) || 0}; setItems(n); }} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={it.unit_cost} onChange={e => { const n=[...items]; n[i] = {...it, unit_cost: Number(e.target.value) || 0}; setItems(n); }} /></TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(it.quantity * it.unit_cost, sym)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setItems(items.filter((_, x) => x !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-2 rounded-md bg-muted/40 p-3">
              <div className="flex justify-between text-sm"><span>Total</span><span className="font-semibold tabular-nums">{fmtMoney(total, sym)}</span></div>
              <div className="mt-1 flex justify-between text-sm"><span>Status</span><Badge variant={payStatus==='paid'?'secondary':payStatus==='partial'?'outline':'destructive'}>{payStatus}</Badge></div>
            </div>
            <div className="col-span-2"><Label>Paid</Label><Input type="number" step="0.01" value={paid || ""} onChange={e=>setPaid(Number(e.target.value) || 0)} /></div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={()=>{ if (!items.length) return toast.error("Add at least one item"); save.mutate(); }} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save Purchase"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
