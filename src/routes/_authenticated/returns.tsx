import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtMoney, useSettings } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/returns")({ component: ReturnsPage });

function ReturnsPage() {
  const settings = useSettings();
  const sym = settings.currency_symbol;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [invoice, setInvoice] = useState("");
  const [sale, setSale] = useState<any>(null);
  const [selected, setSelected] = useState<Record<string, { qty: number; chosen: boolean }>>({});
  const [reason, setReason] = useState("");

  const list = useQuery({
    queryKey: ["returns"],
    queryFn: async () => (await supabase.from("returns").select("*,sales(invoice_no),return_items(product_name,quantity)").order("created_at", { ascending: false })).data ?? [],
  });

  const findSale = async () => {
    if (!invoice.trim()) return;
    const { data } = await supabase.from("sales").select("*,sale_items(*)").eq("invoice_no", invoice.trim()).maybeSingle();
    if (!data) { toast.error("Invoice not found"); setSale(null); return; }
    setSale(data);
    const s: Record<string, { qty: number; chosen: boolean }> = {};
    for (const it of data.sale_items as any[]) s[it.id] = { qty: Number(it.quantity), chosen: false };
    setSelected(s);
  };

  const items = sale ? (sale.sale_items as any[]).filter(it => selected[it.id]?.chosen) : [];
  const totalRefund = items.reduce((a, it) => a + (Number(it.unit_price) * Number(selected[it.id]?.qty ?? 0)), 0);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        sale_id: sale.id,
        total: totalRefund, refund_amount: totalRefund, reason,
        items: items.map(it => ({
          product_id: it.product_id, product_name: it.product_name,
          quantity: selected[it.id].qty, unit_price: it.unit_price,
          total: it.unit_price * selected[it.id].qty,
        })),
      };
      const { error } = await supabase.rpc("process_return", { payload });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Return processed, stock restored"); qc.invalidateQueries({ queryKey: ["returns"] }); qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["pos-products"] }); setOpen(false); setSale(null); setInvoice(""); setReason(""); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
        <div><h1 className="text-2xl font-bold tracking-tight">Returns</h1><p className="text-sm text-muted-foreground">Refund items from past invoices</p></div>
        <Button onClick={()=>setOpen(true)}><Plus className="mr-1 h-4 w-4" />New Return</Button>
      </div>
      <Card><CardContent className="p-4 sm:p-5">
        <div className="overflow-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Ref</TableHead><TableHead>Date</TableHead><TableHead>Invoice</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Refund</TableHead></TableRow></TableHeader>
          <TableBody>
            {(list.data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No returns yet.</TableCell></TableRow>}
            {(list.data ?? []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.reference_no}</TableCell>
                <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="font-mono text-xs">{r.sales?.invoice_no ?? "—"}</TableCell>
                <TableCell>{(r.return_items as any[])?.length ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtMoney(r.refund_amount, sym)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Return</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Invoice number e.g. INV-XXXXXX-XXXX" value={invoice} onChange={e=>setInvoice(e.target.value)} />
              <Button onClick={findSale} variant="outline"><Search className="mr-1 h-4 w-4" />Find</Button>
            </div>
            {sale && (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Product</TableHead><TableHead className="w-28">Sold Qty</TableHead><TableHead className="w-24">Return Qty</TableHead><TableHead className="text-right">Refund</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(sale.sale_items as any[]).map(it => (
                        <TableRow key={it.id}>
                          <TableCell><Checkbox checked={selected[it.id]?.chosen ?? false} onCheckedChange={v => setSelected({...selected, [it.id]: { qty: Number(it.quantity), chosen: !!v }})} /></TableCell>
                          <TableCell>{it.product_name}</TableCell>
                          <TableCell>{it.quantity}</TableCell>
                          <TableCell><Input type="number" step="0.001" disabled={!selected[it.id]?.chosen} value={selected[it.id]?.qty ?? 0} onChange={e => setSelected({...selected, [it.id]: { chosen: true, qty: Math.min(Number(e.target.value) || 0, Number(it.quantity)) }})} /></TableCell>
                          <TableCell className="text-right tabular-nums">{fmtMoney(it.unit_price * (selected[it.id]?.qty ?? 0), sym)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div><Label>Reason</Label><Textarea value={reason} onChange={e=>setReason(e.target.value)} /></div>
                <div className="flex justify-between rounded-md bg-muted/40 p-3 text-sm font-semibold"><span>Refund total</span><span className="tabular-nums">{fmtMoney(totalRefund, sym)}</span></div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button disabled={!items.length || save.isPending} onClick={()=>save.mutate()}>{save.isPending ? "Saving…" : "Process Return"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
