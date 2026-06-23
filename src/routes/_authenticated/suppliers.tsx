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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/suppliers")({ component: SuppliersPage });

const emptyV = { name: "", company_name: "", phone: "", email: "", address: "", notes: "" };
type V = typeof emptyV & { id?: string };

function SuppliersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<V>({ ...emptyV });

  const list = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [] });

  const save = useMutation({
    mutationFn: async (v: V) => {
      if (v.id) { const { error } = await supabase.from("suppliers").update(v).eq("id", v.id); if (error) throw error; }
      else { const { error } = await supabase.from("suppliers").insert(v as any); if (error) throw error; }
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["suppliers"] }); qc.invalidateQueries({ queryKey: ["suppliers-min"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("suppliers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Suppliers</h1><p className="text-sm text-muted-foreground">Vendors you purchase from</p></div>
        <Button onClick={()=>{ setEdit({ ...emptyV }); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />Add Supplier</Button>
      </div>
      <Card><CardContent className="p-3 sm:p-4">
        <div className="overflow-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Company</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
          <TableBody>
            {list.isLoading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!list.isLoading && (list.data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No suppliers yet.</TableCell></TableRow>}
            {(list.data ?? []).map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.company_name}</TableCell>
                <TableCell>{s.phone}</TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={()=>{ setEdit({ ...emptyV, ...s }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete supplier?</AlertDialogTitle><AlertDialogDescription>{s.name} will be removed.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={()=>del.mutate(s.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent></Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit.id ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
          <form onSubmit={e=>{e.preventDefault(); if (!edit.name.trim()) return toast.error("Name required"); save.mutate(edit);}} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Name *</Label><Input required value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})} /></div>
            <div><Label>Company</Label><Input value={edit.company_name} onChange={e=>setEdit({...edit, company_name: e.target.value})} /></div>
            <div><Label>Phone</Label><Input value={edit.phone} onChange={e=>setEdit({...edit, phone: e.target.value})} /></div>
            <div className="sm:col-span-2"><Label>Email</Label><Input type="email" value={edit.email} onChange={e=>setEdit({...edit, email: e.target.value})} /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Textarea value={edit.address} onChange={e=>setEdit({...edit, address: e.target.value})} /></div>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={edit.notes} onChange={e=>setEdit({...edit, notes: e.target.value})} /></div>
            <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
