import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import type { StoragePlace } from "./StoragePlacesManager";

interface Substance {
  id: string;
  gas_type_name: string;
  location: "sol_emmen" | "sol_tilburg";
  max_allowed_kg: number;
  storage_place_id: string | null;
  storage_location: string | null;
}

interface BulkRow {
  id: string;
  tank_name: string;
  location: "sol_emmen" | "sol_tilburg";
  storage_place_id: string | null;
  __kind: "tank";
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAdmin: boolean;
  defaultLocation?: "sol_emmen" | "sol_tilburg";
  onChanged?: () => void;
}

export function PGSAssignStoragePlaceDialog({ open, onOpenChange, isAdmin, defaultLocation = "sol_emmen", onChanged }: Props) {
  const [substances, setSubstances] = useState<Substance[]>([]);
  const [tanks, setTanks] = useState<BulkRow[]>([]);
  const [places, setPlaces] = useState<StoragePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"sol_emmen" | "sol_tilburg">(defaultLocation);

  useEffect(() => {
    if (open) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchAll() {
    setLoading(true);
    const [subRes, tankRes, plRes] = await Promise.all([
      (supabase as any).from("pgs_substances").select("id, location, max_allowed_kg, storage_place_id, storage_location, gas_types(name)").order("location"),
      (supabase as any).from("bulk_storage_tanks").select("id, tank_name, location, storage_place_id").order("tank_name"),
      (supabase as any).from("storage_places").select("*").order("name"),
    ]);
    setSubstances(
      (subRes.data || []).map((s: any) => ({
        id: s.id,
        gas_type_name: s.gas_types?.name || "(Onbekende stof)",
        location: s.location,
        max_allowed_kg: Number(s.max_allowed_kg) || 0,
        storage_place_id: s.storage_place_id,
        storage_location: s.storage_location,
      }))
    );
    setTanks((tankRes.data || []).map((t: any) => ({ ...t, __kind: "tank" as const })));
    setPlaces(plRes.data || []);
    setLoading(false);
  }

  async function updateAssignment(kind: "substance" | "tank", id: string, placeId: string | null) {
    const table = kind === "substance" ? "pgs_substances" : "bulk_storage_tanks";
    const { error } = await (supabase as any).from(table).update({ storage_place_id: placeId }).eq("id", id);
    if (error) { toast.error("Kon niet opslaan: " + error.message); return; }
    if (kind === "substance") {
      setSubstances(prev => prev.map(s => s.id === id ? { ...s, storage_place_id: placeId } : s));
    } else {
      setTanks(prev => prev.map(t => t.id === id ? { ...t, storage_place_id: placeId } : t));
    }
    onChanged?.();
  }

  const filteredSubs = substances.filter(s => s.location === tab);
  const filteredTanks = tanks.filter(t => t.location === tab);
  const filteredPlaces = places.filter(p => p.location === tab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Stoffen toewijzen aan opslagplaatsen
          </DialogTitle>
          <DialogDescription>
            Koppel elke stof en bulktank aan een opslagplaats. Vereist voor de PGS 15:2021 registratie per opslagplaats.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="sol_emmen">Emmen</TabsTrigger>
            <TabsTrigger value="sol_tilburg">Tilburg</TabsTrigger>
          </TabsList>
        </Tabs>

        {filteredPlaces.length === 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300 mt-3">
            Er zijn nog geen opslagplaatsen voor deze locatie. Maak eerst opslagplaatsen aan via "Opslagplaatsen".
          </div>
        )}

        <div className="mt-3 rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stof / Tank</TableHead>
                <TableHead>Vergund (kg)</TableHead>
                <TableHead>Huidige opslagplaats</TableHead>
                <TableHead className="w-72">Toewijzen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Laden...</TableCell></TableRow>
              ) : (
                <>
                  {filteredSubs.map(s => {
                    const current = places.find(p => p.id === s.storage_place_id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.gas_type_name}</TableCell>
                        <TableCell>{s.max_allowed_kg.toLocaleString("nl-NL")}</TableCell>
                        <TableCell>
                          {current ? <Badge variant="outline">{current.name}</Badge> : <span className="text-xs text-muted-foreground">{s.storage_location || "—"}</span>}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={s.storage_place_id || "none"}
                            onValueChange={(v) => isAdmin && updateAssignment("substance", s.id, v === "none" ? null : v)}
                            disabled={!isAdmin}
                          >
                            <SelectTrigger><SelectValue placeholder="Kies opslagplaats..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Geen toewijzing —</SelectItem>
                              {filteredPlaces.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} {p.place_type !== "permanent" && `(${p.place_type === "crossdock" ? "crossdock" : "tijdelijk"})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredTanks.map(t => {
                    const current = places.find(p => p.id === t.storage_place_id);
                    return (
                      <TableRow key={t.id} className="bg-muted/20">
                        <TableCell className="font-medium">
                          <Badge variant="outline" className="mr-2">Bulktank</Badge>{t.tank_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">—</TableCell>
                        <TableCell>
                          {current ? <Badge variant="outline">{current.name}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={t.storage_place_id || "none"}
                            onValueChange={(v) => isAdmin && updateAssignment("tank", t.id, v === "none" ? null : v)}
                            disabled={!isAdmin}
                          >
                            <SelectTrigger><SelectValue placeholder="Kies opslagplaats..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Geen toewijzing —</SelectItem>
                              {filteredPlaces.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredSubs.length === 0 && filteredTanks.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Geen stoffen of tanks voor deze locatie.</TableCell></TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Sluiten</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
