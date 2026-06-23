import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/customers")({ component: CustomersPage });

const emptyV = { name: "", phone: "", email: "", address: "", credit_balance: 0 };
type V = typeof emptyV & { id?: string; is_walk_in?: boolean };

function CustomersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<V>({ ...emptyV });

  const list = useQuery({ queryKey: ["customers"], queryFn: async () => (await supabase.from("customers").select("*").order("is_walk_in", { ascending: false }).order("name")).data ?? [] });

  const save = useMutation({
    mutationFn: async (v: V) => {
      const { id, is_walk_in, ...rest } = v;
      if (id) { const { error } = await supabase.from("customers").update(rest).eq("id", id); if (error) throw error; }
      else { const { error } = await supabase.from("customers").insert(rest as any); if (error) throw error; }
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["customers"] }); qc.invalidateQueries({ queryKey: ["customers-min"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("customers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Customers</h1><p className="text-sm text-muted-foreground">Your shoppers</p></div>
        <Button onClick={()=>{ setEdit({ ...emptyV }); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />Add Customer</Button>
      </div>
      <Card><CardContent className="p-3 sm:p-4">
        <div className="overflow-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
          <TableBody>
            {list.isLoading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!list.isLoading && (list.data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No customers yet.</TableCell></TableRow>}
            {(list.data ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name} {c.is_walk_in && <Badge variant="secondary" className="ml-1">Walk-in</Badge>}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(c.credit_balance).toFixed(2)}</TableCell>
                <TableCell>
                  {!c.is_walk_in && <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={()=>{ setEdit({ ...emptyV, ...c }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete customer?</AlertDialogTitle><AlertDialogDescription>{c.name} will be removed.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={()=>del.mutate(c.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent></Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit.id ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
          <form onSubmit={e=>{e.preventDefault(); if (!edit.name.trim()) return toast.error("Name required"); save.mutate(edit);}} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Name *</Label><Input required value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})} /></div>
            <div><Label>Phone</Label><Input value={edit.phone} onChange={e=>setEdit({...edit, phone: e.target.value})} /></div>
            <div><Label>Email</Label><Input type="email" value={edit.email} onChange={e=>setEdit({...edit, email: e.target.value})} /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Textarea value={edit.address} onChange={e=>setEdit({...edit, address: e.target.value})} /></div>
            <div><Label>Credit balance</Label><Input type="number" step="0.01" value={edit.credit_balance} onChange={e=>setEdit({...edit, credit_balance: Number(e.target.value)})} /></div>
            <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
