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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogDescription } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/categories")({ component: CategoriesPage });

function CategoriesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{id?: string; name: string; description: string}>({ name: "", description: "" });

  const list = useQuery({
    queryKey: ["categories-with-counts"],
    queryFn: async () => {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("products").select("category_id"),
      ]);
      const counts = new Map<string, number>();
      for (const p of (prods as any[]) ?? []) {
        if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
      }
      return (cats ?? []).map((c: any) => ({ ...c, count: counts.get(c.id) ?? 0 }));
    },
  });

  const save = useMutation({
    mutationFn: async (v: typeof edit) => {
      if (v.id) {
        const { error } = await supabase.from("categories").update({ name: v.name, description: v.description }).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert({ name: v.name, description: v.description });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["categories-with-counts"] }); qc.invalidateQueries({ queryKey: ["categories"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["categories-with-counts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Categories</h1><p className="text-sm text-muted-foreground">Organize products into groups</p></div>
        <Button onClick={() => { setEdit({ name: "", description: "" }); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />Add Category</Button>
      </div>
      <Card><CardContent className="p-3 sm:p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Products</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
          <TableBody>
            {list.isLoading && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!list.isLoading && (list.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No categories yet.</TableCell></TableRow>}
            {(list.data ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.description}</TableCell>
                <TableCell className="text-right">{c.count}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEdit({ id: c.id, name: c.name, description: c.description ?? "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete category?</AlertDialogTitle><AlertDialogDescription>Products in this category will be left uncategorised.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(c.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit.id ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <form onSubmit={e=>{e.preventDefault(); if (!edit.name.trim()) return toast.error("Name required"); save.mutate(edit);}} className="space-y-3">
            <div><Label>Name *</Label><Input required value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})} /></div>
            <div><Label>Description</Label><Textarea value={edit.description} onChange={e=>setEdit({...edit, description: e.target.value})} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
