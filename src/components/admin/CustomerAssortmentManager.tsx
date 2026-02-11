import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface Product {
  id: string;
  article_code: string;
  name: string;
  category: string | null;
  is_active: boolean;
}

interface Customer {
  id: string;
  name: string;
  is_active: boolean;
}

interface AssortmentItem {
  id: string;
  product_id: string;
  warehouse: string | null;
  product: Product;
}

export function CustomerAssortmentManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [assortment, setAssortment] = useState<AssortmentItem[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      setCustomers(data || []);
    };
    fetchCustomers();
  }, []);

  // Fetch all products
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, article_code, name, category, is_active")
        .eq("is_active", true)
        .order("sort_order");
      setAllProducts(data || []);
    };
    fetchProducts();
  }, []);

  // Fetch assortment for selected customer
  useEffect(() => {
    if (!selectedCustomerId) {
      setAssortment([]);
      return;
    }

    const fetchAssortment = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("customer_products")
        .select("id, product_id, warehouse, product:products(id, article_code, name, category, is_active)")
        .eq("customer_id", selectedCustomerId);

      if (error) {
        console.error(error);
        toast.error("Fout bij ophalen assortiment");
      } else {
        setAssortment(
          (data || []).map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            warehouse: item.warehouse,
            product: item.product,
          }))
        );
      }
      setLoading(false);
    };
    fetchAssortment();
  }, [selectedCustomerId]);

  // Products not yet in assortment
  const availableProducts = useMemo(() => {
    const assignedIds = new Set(assortment.map(a => a.product_id));
    return allProducts
      .filter(p => !assignedIds.has(p.id))
      .filter(p => {
        const q = productSearch.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.article_code.toLowerCase().includes(q);
      });
  }, [allProducts, assortment, productSearch]);

  // Grouped assortment
  const groupedAssortment = useMemo(() => {
    const filtered = assortment.filter(item => {
      const q = search.toLowerCase();
      return (
        item.product.name.toLowerCase().includes(q) ||
        item.product.article_code.toLowerCase().includes(q)
      );
    });

    const groups: Record<string, AssortmentItem[]> = {};
    filtered.forEach(item => {
      const cat = item.product.category || "Overig";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [assortment, search]);

  const addProduct = async (productId: string) => {
    if (!selectedCustomerId) return;

    const { data, error } = await supabase
      .from("customer_products")
      .insert({ customer_id: selectedCustomerId, product_id: productId })
      .select("id, product_id, warehouse, product:products(id, article_code, name, category, is_active)")
      .single();

    if (error) {
      toast.error("Fout bij toevoegen product");
      return;
    }

    setAssortment(prev => [
      ...prev,
      {
        id: data.id,
        product_id: data.product_id,
        warehouse: (data as any).warehouse,
        product: (data as any).product,
      },
    ]);
    toast.success("Product toegevoegd aan assortiment");
  };

  const removeProduct = async (itemId: string) => {
    const { error } = await supabase.from("customer_products").delete().eq("id", itemId);
    if (error) {
      toast.error("Fout bij verwijderen product");
      return;
    }
    setAssortment(prev => prev.filter(a => a.id !== itemId));
    toast.success("Product verwijderd uit assortiment");
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Klant Assortimentbeheer</h3>
        <p className="text-sm text-muted-foreground">Koppel producten aan klanten zodat zij deze kunnen bestellen.</p>
      </div>

      {/* Customer select */}
      <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
        <SelectTrigger className="w-full max-w-sm">
          <SelectValue placeholder="Selecteer een klant..." />
        </SelectTrigger>
        <SelectContent>
          {customers.map(c => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedCustomerId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Current assortment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Huidig assortiment ({assortment.length})</span>
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek in assortiment..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : assortment.length === 0 ? (
              <EmptyState
                  variant="orders"
                  title="Nog geen producten"
                  description="Voeg producten toe uit de lijst rechts."
                />
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {groupedAssortment.map(([category, items]) => (
                    <div key={category}>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-1">{category}</h4>
                      <div className="space-y-1">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded border text-sm">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium truncate block">{item.product.name}</span>
                              <span className="text-xs text-muted-foreground font-mono">{item.product.article_code}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeProduct(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add products */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Producten toevoegen</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek producten..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {availableProducts.slice(0, 50).map(product => (
                  <div key={product.id} className="flex items-center justify-between p-2 rounded border text-sm hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{product.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">{product.article_code}</span>
                        {product.category && (
                          <Badge variant="outline" className="text-xs">{product.category}</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary"
                      onClick={() => addProduct(product.id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {availableProducts.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nog {availableProducts.length - 50} producten. Gebruik de zoekbalk om te filteren.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
