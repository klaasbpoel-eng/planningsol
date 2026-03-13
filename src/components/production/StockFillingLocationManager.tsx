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

interface StockProduct {
  id: string;
  sub_code: string;
  description: string;
  filled_in_emmen: boolean;
}

interface StockFillingLocationManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockFillingLocationManager({ open, onOpenChange }: StockFillingLocationManagerProps) {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stock_products")
      .select("*")
      .order("sub_code");
    if (error) {
      toast.error("Fout bij laden producten");
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchProducts();
      setSelected(new Set());
      setSearch("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.sub_code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [products, search]);

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

  const handleBulkUpdate = async (filledInEmmen: boolean) => {
    if (selected.size === 0) return;
    setSaving(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("stock_products")
      .update({ filled_in_emmen: filledInEmmen })
      .in("id", ids);
    if (error) {
      toast.error("Fout bij opslaan");
      console.error(error);
    } else {
      toast.success(`${ids.length} producten bijgewerkt`);
      setProducts((prev) =>
        prev.map((p) => (ids.includes(p.id) ? { ...p, filled_in_emmen: filledInEmmen } : p))
      );
      setSelected(new Set());
    }
    setSaving(false);
  };

  const handleToggleSingle = async (product: StockProduct) => {
    const newValue = !product.filled_in_emmen;
    const { error } = await supabase
      .from("stock_products")
      .update({ filled_in_emmen: newValue })
      .eq("id", product.id);
    if (error) {
      toast.error("Fout bij opslaan");
    } else {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, filled_in_emmen: newValue } : p))
      );
    }
  };

  const emmenCount = products.filter((p) => p.filled_in_emmen).length;
  const externCount = products.length - emmenCount;

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
          <Badge variant="outline">{emmenCount} Emmen</Badge>
          <Badge variant="secondary">{externCount} Extern</Badge>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">{selected.size} geselecteerd</span>
            <Button size="sm" onClick={() => handleBulkUpdate(true)} disabled={saving}>
              Markeer als Emmen
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkUpdate(false)} disabled={saving}>
              Markeer als extern
            </Button>
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
                  <th className="text-center p-2 font-medium">Gevuld in Emmen</th>
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
                      <Checkbox
                        checked={product.filled_in_emmen}
                        onCheckedChange={() => handleToggleSingle(product)}
                      />
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
