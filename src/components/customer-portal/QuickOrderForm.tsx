import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Minus, ShoppingCart, Send, CalendarDays, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useCustomerPortal } from "@/hooks/useCustomerPortal";
import { Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface QuickOrderFormProps {
  userId: string;
}

export function QuickOrderForm({ userId }: QuickOrderFormProps) {
  const {
    customerUser,
    assortment,
    loading,
    cart,
    updateQuantity,
    getQuantity,
    clearCart,
    totalItems,
    submitOrder,
  } = useCustomerPortal(userId);

  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Group by category
  const groupedProducts = useMemo(() => {
    const filtered = assortment.filter(item => {
      const q = search.toLowerCase();
      return (
        item.product.name.toLowerCase().includes(q) ||
        item.product.article_code.toLowerCase().includes(q) ||
        (item.product.description || "").toLowerCase().includes(q)
      );
    });

    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(item => {
      const cat = item.product.category || "Overig";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    // Sort categories and products
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => a.product.sort_order - b.product.sort_order),
      }));
  }, [assortment, search]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const orderNumber = await submitOrder(notes, deliveryDate ? format(deliveryDate, "yyyy-MM-dd") : null);
    setSubmitting(false);
    if (orderNumber) {
      setOrderSuccess(orderNumber);
      setNotes("");
      setDeliveryDate(undefined);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customerUser) {
    return (
      <EmptyState
        variant="generic"
        title="Geen klantaccount gekoppeld"
        description="Je account is nog niet aan een klant gekoppeld. Neem contact op met de beheerder."
      />
    );
  }

  if (orderSuccess) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <ShoppingCart className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Bestelling geplaatst!</h2>
          <p className="text-muted-foreground">
            Je bestelling <span className="font-mono font-semibold text-foreground">{orderSuccess}</span> is succesvol ingediend.
          </p>
          <Button onClick={() => setOrderSuccess(null)} className="mt-4">
            Nieuwe bestelling plaatsen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product list */}
      <div className="lg:col-span-2 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam of artikelcode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {assortment.length === 0 ? (
          <EmptyState
            variant="orders"
            title="Geen producten in je assortiment"
            description="Er zijn nog geen producten aan je account gekoppeld."
          />
        ) : groupedProducts.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Geen producten gevonden voor "{search}"</p>
        ) : (
          groupedProducts.map(group => (
            <Card key={group.category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  {group.category}
                  <Badge variant="secondary" className="text-xs">{group.items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.items.map(item => {
                  const qty = getQuantity(item.product.id);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        qty > 0 ? "bg-accent border-primary/20" : "bg-background border-border"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.product.article_code}</p>
                        {item.product.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.product.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              item.product.article_code,
                              item.product.name,
                              item.product.category,
                              Math.max(0, qty - 1)
                            )
                          }
                          disabled={qty === 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={e =>
                            updateQuantity(
                              item.product.id,
                              item.product.article_code,
                              item.product.name,
                              item.product.category,
                              Math.max(0, parseInt(e.target.value) || 0)
                            )
                          }
                          className="w-16 h-8 text-center text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              item.product.article_code,
                              item.product.name,
                              item.product.category,
                              qty + 1
                            )
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Cart sidebar */}
      <div className="space-y-4">
        <Card className="sticky top-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Winkelwagen
              {totalItems > 0 && (
                <Badge className="ml-auto">{totalItems}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nog geen producten toegevoegd
              </p>
            ) : (
              <>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.product_id} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.article_code}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant="secondary">{item.quantity}x</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => updateQuantity(item.product_id, item.article_code, item.product_name, item.category, 0)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-medium">Totaal items:</span>
                  <span className="font-bold">{totalItems}</span>
                </div>

                <Button variant="outline" size="sm" onClick={clearCart} className="w-full">
                  <Trash2 className="h-3 w-3 mr-2" />
                  Winkelwagen legen
                </Button>
              </>
            )}

            <Separator />

            {/* Delivery date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Gewenste leverdatum</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {deliveryDate ? format(deliveryDate, "d MMMM yyyy", { locale: nl }) : "Selecteer datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={deliveryDate}
                    onSelect={setDeliveryDate}
                    disabled={date => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Opmerkingen</label>
              <Textarea
                placeholder="Eventuele opmerkingen bij je bestelling..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={cart.length === 0 || submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Bestelling plaatsen
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
