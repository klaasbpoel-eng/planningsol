import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Package } from "lucide-react";

interface PkgRow {
  id: string;
  bundle_capacity_liters: number;
  cylinders_per_pack: number;
  single_cylinder_liters: number;
  description: string | null;
  is_active: boolean;
}

export function GasFlowPackagesTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["gas_packages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gas_packages")
        .select("*")
        .order("bundle_capacity_liters", { ascending: false });
      if (error) throw error;
      return (data || []) as PkgRow[];
    },
  });

  const [draft, setDraft] = useState({ bundle: "", cylinders: "", single: "50", description: "" });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["gas_packages"] });
    qc.invalidateQueries({ queryKey: ["gasFlowPredictions"] });
  };

  const addRow = async () => {
    const bundle = Number(draft.bundle);
    const cylinders = parseInt(draft.cylinders);
    const single = Number(draft.single) || 50;
    if (!bundle || !cylinders) {
      toast.error("Bundel-capaciteit en aantal cilinders zijn verplicht");
      return;
    }
    const { error } = await (supabase as any).from("gas_packages").insert({
      bundle_capacity_liters: bundle,
      cylinders_per_pack: cylinders,
      single_cylinder_liters: single,
      description: draft.description || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Pakket toegevoegd");
    setDraft({ bundle: "", cylinders: "", single: "50", description: "" });
    refresh();
  };

  const updateRow = async (id: string, patch: Partial<PkgRow>) => {
    const { error } = await (supabase as any).from("gas_packages").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const deleteRow = async (id: string) => {
    const { error } = await (supabase as any).from("gas_packages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Verwijderd");
    refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" /> Pakket-/bundel-mapping
        </CardTitle>
        <CardDescription>
          Bepaal hoeveel individuele cilinders één bundel/pakket bevat. Wordt toegepast op zowel
          voorraad als afname (bv. 1 rij van 800L = 16 cilinders van 50L).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end p-3 border rounded-md bg-muted/30">
          <div>
            <label className="text-xs font-medium">Bundel-capaciteit (L)</label>
            <Input type="number" value={draft.bundle} onChange={(e) => setDraft({ ...draft, bundle: e.target.value })} placeholder="800" />
          </div>
          <div>
            <label className="text-xs font-medium">Cilinders per pakket</label>
            <Input type="number" value={draft.cylinders} onChange={(e) => setDraft({ ...draft, cylinders: e.target.value })} placeholder="16" />
          </div>
          <div>
            <label className="text-xs font-medium">Capaciteit per cilinder (L)</label>
            <Input type="number" value={draft.single} onChange={(e) => setDraft({ ...draft, single: e.target.value })} placeholder="50" />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium">Omschrijving</label>
            <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="optioneel" />
          </div>
          <Button onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Toevoegen</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bundel (L)</TableHead>
              <TableHead>Cilinders/pakket</TableHead>
              <TableHead>Per cilinder (L)</TableHead>
              <TableHead>Omschrijving</TableHead>
              <TableHead>Actief</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6}>Laden…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">Geen pakketten geconfigureerd</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Input type="number" defaultValue={r.bundle_capacity_liters} onBlur={(e) => updateRow(r.id, { bundle_capacity_liters: Number(e.target.value) })} className="h-8 w-24" /></TableCell>
                <TableCell><Input type="number" defaultValue={r.cylinders_per_pack} onBlur={(e) => updateRow(r.id, { cylinders_per_pack: parseInt(e.target.value) })} className="h-8 w-24" /></TableCell>
                <TableCell><Input type="number" defaultValue={r.single_cylinder_liters} onBlur={(e) => updateRow(r.id, { single_cylinder_liters: Number(e.target.value) })} className="h-8 w-24" /></TableCell>
                <TableCell><Input defaultValue={r.description ?? ""} onBlur={(e) => updateRow(r.id, { description: e.target.value })} className="h-8" /></TableCell>
                <TableCell><Switch checked={r.is_active} onCheckedChange={(v) => updateRow(r.id, { is_active: v })} /></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => deleteRow(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}