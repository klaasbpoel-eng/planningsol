import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";

export type PlaceType = "permanent" | "temporary" | "crossdock";

export interface StoragePlace {
  id: string;
  location: "sol_emmen" | "sol_tilburg";
  name: string;
  code: string | null;
  place_type: PlaceType;
  max_residence_hours: number | null;
  pgs_guideline: string;
  description: string | null;
  notes: string | null;
  is_active: boolean;
}

const PLACE_TYPE_LABEL: Record<PlaceType, string> = {
  permanent: "Vast",
  temporary: "Tijdelijk",
  crossdock: "Crossdock",
};

const PLACE_TYPE_COLOR: Record<PlaceType, string> = {
  permanent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  temporary: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  crossdock: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAdmin: boolean;
  initialLocation?: "sol_emmen" | "sol_tilburg";
  onChanged?: () => void;
}

const EMPTY_FORM = {
  name: "",
  code: "",
  place_type: "permanent" as PlaceType,
  max_residence_hours: "" as string,
  pgs_guideline: "PGS 15",
  description: "",
  notes: "",
};

export function StoragePlacesManager({ open, onOpenChange, isAdmin, initialLocation = "sol_emmen", onChanged }: Props) {
  const [places, setPlaces] = useState<StoragePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"sol_emmen" | "sol_tilburg">(initialLocation);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) fetchPlaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchPlaces() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("storage_places")
      .select("*")
      .order("location")
      .order("name");
    if (error) toast.error("Kon opslagplaatsen niet laden");
    else setPlaces((data as any) || []);
    setLoading(false);
  }

  function startEdit(p?: StoragePlace) {
    if (p) {
      setEditingId(p.id);
      setForm({
        name: p.name,
        code: p.code ?? "",
        place_type: p.place_type,
        max_residence_hours: p.max_residence_hours != null ? String(p.max_residence_hours) : "",
        pgs_guideline: p.pgs_guideline,
        description: p.description ?? "",
        notes: p.notes ?? "",
      });
    } else {
      setEditingId("__new__");
      setForm({ ...EMPTY_FORM });
    }
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }
    setSaving(true);
    const payload = {
      location: tab,
      name: form.name.trim(),
      code: form.code.trim() || null,
      place_type: form.place_type,
      max_residence_hours: form.max_residence_hours.trim() === "" ? null : Number(form.max_residence_hours),
      pgs_guideline: form.pgs_guideline.trim() || "PGS 15",
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
    } as any;

    let error;
    if (editingId && editingId !== "__new__") {
      ({ error } = await (supabase as any).from("storage_places").update(payload).eq("id", editingId));
    } else {
      ({ error } = await (supabase as any).from("storage_places").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error("Opslaan mislukt: " + error.message);
      return;
    }
    toast.success("Opslagplaats opgeslagen");
    setEditingId(null);
    fetchPlaces();
    onChanged?.();
  }

  async function remove(p: StoragePlace) {
    if (!confirm(`Verwijder opslagplaats "${p.name}"?`)) return;
    const { error } = await (supabase as any).from("storage_places").delete().eq("id", p.id);
    if (error) toast.error("Verwijderen mislukt: " + error.message);
    else {
      toast.success("Verwijderd");
      fetchPlaces();
      onChanged?.();
    }
  }

  const filtered = places.filter(p => p.location === tab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Opslagplaatsen beheren
          </DialogTitle>
          <DialogDescription>
            Beheer permanente, tijdelijke en crossdock-opslagplaatsen per locatie (PGS 15:2021).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="sol_emmen">Emmen</TabsTrigger>
            <TabsTrigger value="sol_tilburg">Tilburg</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="space-y-3 mt-3">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">{filtered.length} opslagplaats(en)</div>
              {isAdmin && (
                <Button size="sm" onClick={() => startEdit()} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Nieuwe opslagplaats
                </Button>
              )}
            </div>

            {editingId && (
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Naam *</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="bijv. Cilinderbunker 1, Afdak E1" />
                  </div>
                  <div className="space-y-1">
                    <Label>Code (optioneel)</Label>
                    <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="bijv. CB-01" />
                  </div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select value={form.place_type} onValueChange={(v) => setForm({ ...form, place_type: v as PlaceType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permanent">Vast (permanente opslag)</SelectItem>
                        <SelectItem value="temporary">Tijdelijk / incidenteel</SelectItem>
                        <SelectItem value="crossdock">Crossdock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>PGS-richtlijn</Label>
                    <Input value={form.pgs_guideline} onChange={e => setForm({ ...form, pgs_guideline: e.target.value })} />
                  </div>
                  {(form.place_type === "crossdock" || form.place_type === "temporary") && (
                    <div className="space-y-1 md:col-span-2">
                      <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Maximale verblijftijd (uren)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.max_residence_hours}
                        onChange={e => setForm({ ...form, max_residence_hours: e.target.value })}
                        placeholder="bijv. 48"
                      />
                    </div>
                  )}
                  <div className="space-y-1 md:col-span-2">
                    <Label>Beschrijving</Label>
                    <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Locatie/omschrijving" />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Opmerkingen</Label>
                    <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingId(null)} disabled={saving}>Annuleren</Button>
                  <Button onClick={save} disabled={saving}>{saving ? "Opslaan..." : "Opslaan"}</Button>
                </div>
              </div>
            )}

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Max. verblijftijd</TableHead>
                    <TableHead>PGS</TableHead>
                    <TableHead>Beschrijving</TableHead>
                    {isAdmin && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Laden...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nog geen opslagplaatsen voor deze locatie.</TableCell></TableRow>
                  ) : (
                    filtered.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.name}
                          {p.code && <span className="ml-2 text-xs text-muted-foreground">({p.code})</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={PLACE_TYPE_COLOR[p.place_type]}>
                            {PLACE_TYPE_LABEL[p.place_type]}
                          </Badge>
                        </TableCell>
                        <TableCell>{p.max_residence_hours != null ? `${p.max_residence_hours} u` : "—"}</TableCell>
                        <TableCell><span className="text-xs">{p.pgs_guideline}</span></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{p.description || "—"}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => startEdit(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(p)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
