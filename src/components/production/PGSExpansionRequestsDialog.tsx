import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, TrendingUp, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { StoragePlace } from "./StoragePlacesManager";

type Status = "draft" | "submitted" | "approved" | "rejected";

interface ExpansionRequest {
  id: string;
  gas_type_id: string | null;
  substance_name: string;
  location: "sol_emmen" | "sol_tilburg";
  target_storage_place_id: string | null;
  current_permitted_kg: number;
  requested_permitted_kg: number;
  motivation: string | null;
  status: Status;
  requested_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<Status, string> = {
  draft: "Concept",
  submitted: "Ingediend",
  approved: "Goedgekeurd",
  rejected: "Afgewezen",
};
const STATUS_COLOR: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAdmin: boolean;
  defaultLocation?: "sol_emmen" | "sol_tilburg";
}

export function PGSExpansionRequestsDialog({ open, onOpenChange, isAdmin, defaultLocation = "sol_emmen" }: Props) {
  const [requests, setRequests] = useState<ExpansionRequest[]>([]);
  const [places, setPlaces] = useState<StoragePlace[]>([]);
  const [substances, setSubstances] = useState<Array<{ id: string; gas_type_id: string | null; gas_type_name: string; location: string; max_allowed_kg: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    location: defaultLocation as "sol_emmen" | "sol_tilburg",
    substance_name: "",
    gas_type_id: "" as string,
    target_storage_place_id: "" as string,
    current_permitted_kg: "0",
    requested_permitted_kg: "0",
    motivation: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchAll() {
    setLoading(true);
    const [reqRes, plRes, subRes] = await Promise.all([
      (supabase as any).from("pgs_expansion_requests").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("storage_places").select("*").order("name"),
      (supabase as any).from("pgs_substances").select("id, gas_type_id, location, max_allowed_kg, gas_types(name)"),
    ]);
    if (reqRes.error) toast.error("Aanvragen laden mislukt");
    else setRequests(reqRes.data || []);
    setPlaces(plRes.data || []);
    setSubstances(
      (subRes.data || []).map((s: any) => ({
        id: s.id,
        gas_type_id: s.gas_type_id,
        gas_type_name: s.gas_types?.name || "(Onbekende stof)",
        location: s.location,
        max_allowed_kg: Number(s.max_allowed_kg) || 0,
      }))
    );
    setLoading(false);
  }

  function pickSubstance(substanceId: string) {
    const s = substances.find(x => x.id === substanceId);
    if (!s) return;
    setForm(f => ({
      ...f,
      substance_name: s.gas_type_name,
      gas_type_id: s.gas_type_id || "",
      location: s.location as any,
      current_permitted_kg: String(s.max_allowed_kg),
    }));
  }

  async function saveNew() {
    if (!form.substance_name.trim()) { toast.error("Kies een stof"); return; }
    const reqKg = Number(form.requested_permitted_kg);
    const curKg = Number(form.current_permitted_kg);
    if (!(reqKg > 0)) { toast.error("Gewenste hoeveelheid moet > 0 zijn"); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("pgs_expansion_requests").insert({
      gas_type_id: form.gas_type_id || null,
      substance_name: form.substance_name.trim(),
      location: form.location,
      target_storage_place_id: form.target_storage_place_id || null,
      current_permitted_kg: curKg,
      requested_permitted_kg: reqKg,
      motivation: form.motivation.trim() || null,
      status: "draft" as Status,
      requested_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error("Opslaan mislukt: " + error.message); return; }
    toast.success("Aanvraag toegevoegd");
    setCreating(false);
    setForm(f => ({ ...f, substance_name: "", gas_type_id: "", target_storage_place_id: "", current_permitted_kg: "0", requested_permitted_kg: "0", motivation: "" }));
    fetchAll();
  }

  async function setStatus(id: string, status: Status) {
    const { error } = await (supabase as any).from("pgs_expansion_requests").update({ status, decided_at: status === "approved" || status === "rejected" ? new Date().toISOString() : null }).eq("id", id);
    if (error) toast.error("Statuswijziging mislukt");
    else fetchAll();
  }

  async function remove(id: string) {
    if (!confirm("Aanvraag verwijderen?")) return;
    const { error } = await (supabase as any).from("pgs_expansion_requests").delete().eq("id", id);
    if (error) toast.error("Verwijderen mislukt");
    else fetchAll();
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFontSize(16);
    doc.text("Aanvraag uitbreiding vergunde hoeveelheden", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Conform PGS 15:2021 v1.0 — gegenereerd ${new Date().toLocaleDateString("nl-NL")}`, 14, 24);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 30,
      head: [["Stof", "Locatie", "Opslagplaats", "Huidig (kg)", "Gewenst (kg)", "Δ (kg)", "Status", "Motivatie"]],
      body: requests.map(r => {
        const place = places.find(p => p.id === r.target_storage_place_id);
        return [
          r.substance_name,
          r.location === "sol_emmen" ? "Emmen" : "Tilburg",
          place?.name || "—",
          r.current_permitted_kg.toLocaleString("nl-NL"),
          r.requested_permitted_kg.toLocaleString("nl-NL"),
          (r.requested_permitted_kg - r.current_permitted_kg).toLocaleString("nl-NL"),
          STATUS_LABEL[r.status],
          r.motivation || "—",
        ];
      }),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 64, 175] },
      columnStyles: { 7: { cellWidth: 50 } },
    });
    doc.save(`uitbreidingsaanvraag-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF gegenereerd");
  }

  const filteredPlaces = places.filter(p => p.location === form.location);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Uitbreidingsaanvragen
          </DialogTitle>
          <DialogDescription>
            Beheer aanvragen voor uitbreiding van vergunde hoeveelheden gevaarlijke stoffen per opslagplaats.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-between items-center mb-3">
          <div className="text-sm text-muted-foreground">{requests.length} aanvraag/-vragen</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5" disabled={requests.length === 0}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
            {(isAdmin) && (
              <Button size="sm" onClick={() => setCreating(!creating)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Nieuwe aanvraag
              </Button>
            )}
          </div>
        </div>

        {creating && (
          <div className="rounded-lg border p-3 mb-3 bg-muted/30 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label>Stof (uit register)</Label>
                <Select onValueChange={pickSubstance}>
                  <SelectTrigger><SelectValue placeholder="Kies bestaande stof..." /></SelectTrigger>
                  <SelectContent>
                    {substances.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.gas_type_name} — {s.location === "sol_emmen" ? "Emmen" : "Tilburg"} (huidig {s.max_allowed_kg} kg)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Stofnaam *</Label>
                <Input value={form.substance_name} onChange={e => setForm({ ...form, substance_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Locatie</Label>
                <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v as any, target_storage_place_id: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sol_emmen">Emmen</SelectItem>
                    <SelectItem value="sol_tilburg">Tilburg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Doel-opslagplaats</Label>
                <Select value={form.target_storage_place_id || "none"} onValueChange={(v) => setForm({ ...form, target_storage_place_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Kies opslagplaats..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nog niet bepaald</SelectItem>
                    {filteredPlaces.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Huidige vergunde hoeveelheid (kg)</Label>
                <Input type="number" value={form.current_permitted_kg} onChange={e => setForm({ ...form, current_permitted_kg: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Gewenste vergunde hoeveelheid (kg) *</Label>
                <Input type="number" value={form.requested_permitted_kg} onChange={e => setForm({ ...form, requested_permitted_kg: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Motivatie</Label>
                <Textarea rows={3} value={form.motivation} onChange={e => setForm({ ...form, motivation: e.target.value })} placeholder="Waarom is uitbreiding noodzakelijk?" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>Annuleren</Button>
              <Button onClick={saveNew} disabled={saving}>{saving ? "Opslaan..." : "Opslaan"}</Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stof</TableHead>
                <TableHead>Locatie</TableHead>
                <TableHead>Opslagplaats</TableHead>
                <TableHead className="text-right">Huidig (kg)</TableHead>
                <TableHead className="text-right">Gewenst (kg)</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Laden...</TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nog geen aanvragen.</TableCell></TableRow>
              ) : (
                requests.map(r => {
                  const place = places.find(p => p.id === r.target_storage_place_id);
                  const delta = r.requested_permitted_kg - r.current_permitted_kg;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.substance_name}</TableCell>
                      <TableCell>{r.location === "sol_emmen" ? "Emmen" : "Tilburg"}</TableCell>
                      <TableCell className="text-xs">{place?.name || "—"}</TableCell>
                      <TableCell className="text-right">{r.current_permitted_kg.toLocaleString("nl-NL")}</TableCell>
                      <TableCell className="text-right font-medium">{r.requested_permitted_kg.toLocaleString("nl-NL")}</TableCell>
                      <TableCell className={`text-right ${delta > 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {delta > 0 ? "+" : ""}{delta.toLocaleString("nl-NL")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {isAdmin && r.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "submitted")}>Indienen</Button>
                        )}
                        {isAdmin && r.status === "submitted" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "approved")}>Goedkeuren</Button>
                            <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "rejected")}>Afwijzen</Button>
                          </>
                        )}
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
