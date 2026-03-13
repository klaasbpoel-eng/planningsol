import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Search, Loader2 } from "lucide-react";

type FillLocation = "emmen" | "tilburg" | "extern";

interface StockProduct {
  id: string;
  sub_code: string;
  description: string;
  fill_location: FillLocation;
}

interface StockFillingLocationManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LOCATION_LABELS: Record<FillLocation, string> = {
  emmen: "Emmen",
  tilburg: "Tilburg",
  extern: "Extern",
};

const LOCATION_VARIANTS: Record<FillLocation, "default" | "secondary" | "outline"> = {
  emmen: "default",
  tilburg: "secondary",
  extern: "outline",
};

export function StockFillingLocationManager({ open, onOpenChange }: StockFillingLocationManagerProps) {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locationFilter, setLocationFilter] = useState<FillLocation | "all">("all");

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stock_products")
      .select("id, sub_code, description, fill_location")
      .order("sub_code");
    if (error) {
      toast.error("Fout bij laden producten");
      console.error(error);
    } else {
      setProducts((data || []).map((p) => ({
        ...p,
        fill_location: (p.fill_location as FillLocation) ?? "emmen",
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchProducts();
      setSelected(new Set());
      setSearch("");
      setLocationFilter("all");
    }
  }, [open]);

  const filtered = useMemo(() => {
    let result = products;
    if (locationFilter !== "all") result = result.filter((p) => p.fill_location === locationFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.sub_code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, search, locationFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const newSelected = new Set(selected);
      filtered.forEach((p) => newSelected.delete(p.id));
      setSelected(newSelected);
    } else {
      const newSelected = new Set(selected);
      filtered.forEach((p) => newSelected.add(p.id));
      setSelected(newSelected);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelected(newSelected);
  };

  const handleBulkUpdate = async (loc: FillLocation) => {
    if (selected.size === 0) return;
    setSaving(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("stock_products")
      .update({ fill_location: loc })
      .in("id", ids);
    if (error) {
      toast.error("Fout bij opslaan");
      console.error(error);
    } else {
      toast.success(`${ids.length} producten bijgewerkt`);
      setProducts((prev) =>
        prev.map((p) => (ids.includes(p.id) ? { ...p, fill_location: loc } : p))
      );
      setSelected(new Set());
    }
    setSaving(false);
  };

  const handleToggleSingle = async (product: StockProduct) => {
    const order: FillLocation[] = ["emmen", "tilburg", "extern"];
    const next = order[(order.indexOf(product.fill_location) + 1) % order.length];
    const { error } = await supabase
      .from("stock_products")
      .update({ fill_location: next })
      .eq("id", product.id);
    if (error) {
      toast.error("Fout bij opslaan");
    } else {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, fill_location: next } : p))
      );
    }
  };

  const counts = useMemo(() => ({
    emmen: products.filter((p) => p.fill_location === "emmen").length,
    tilburg: products.filter((p) => p.fill_location === "tilburg").length,
    extern: products.filter((p) => p.fill_location === "extern").length,
  }), [products]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Vullocatie Beheer
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op code of omschrijving..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {(["emmen", "tilburg", "extern"] as FillLocation[]).map((loc) => (
            <Badge
              key={loc}
              variant={locationFilter === loc ? "default" : LOCATION_VARIANTS[loc]}
              className="cursor-pointer select-none"
              onClick={() => setLocationFilter(locationFilter === loc ? "all" : loc)}
            >
              {counts[loc]} {LOCATION_LABELS[loc]}
            </Badge>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg flex-wrap">
            <span className="text-sm font-medium">{selected.size} geselecteerd</span>
            {(["emmen", "tilburg", "extern"] as FillLocation[]).map((loc) => (
              <Button key={loc} size="sm" variant={loc === "emmen" ? "default" : "outline"} onClick={() => handleBulkUpdate(loc)} disabled={saving}>
                {LOCATION_LABELS[loc]}
              </Button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Geen producten gevonden. Laad de voorraadpagina opnieuw om producten te synchroniseren.
          </div>
        ) : (
          <ScrollArea className="flex-1 border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-2 w-8">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left p-2 font-medium">Code</th>
                  <th className="text-left p-2 font-medium">Omschrijving</th>
                  <th className="text-center p-2 font-medium">Vullocatie</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} className="border-t hover:bg-muted/30">
                    <td className="p-2">
                      <Checkbox
                        checked={selected.has(product.id)}
                        onCheckedChange={() => toggleSelect(product.id)}
                      />
                    </td>
                    <td className="p-2 font-mono text-xs">{product.sub_code}</td>
                    <td className="p-2 max-w-[300px] truncate">{product.description}</td>
                    <td className="p-2 text-center">
                      <Badge
                        variant={LOCATION_VARIANTS[product.fill_location]}
                        className="cursor-pointer select-none"
                        onClick={() => handleToggleSingle(product)}
                        title="Klik om te wijzigen"
                      >
                        {LOCATION_LABELS[product.fill_location]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
