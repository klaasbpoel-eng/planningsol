import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, CalendarIcon, Check, ChevronsUpDown, Plus, Minus, Trash2, Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  address: string | null;
}

interface Product {
  id: string;
  article_code: string;
  name: string;
  category: string | null;
  size_liters: number | null;
}

interface OrderItem {
  productId: string;
  articleCode: string;
  productName: string;
  quantity: number;
}

export function InternalOrderForm() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerProducts, setCustomerProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerProducts(selectedCustomer.id);
    } else {
      setCustomerProducts([]);
    }
  }, [selectedCustomer]);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, address")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setCustomers(data);
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, article_code, name, category, size_liters")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setProducts(data);
    }
  };

  const fetchCustomerProducts = async (customerId: string) => {
    const { data, error } = await supabase
      .from("customer_products")
      .select("product_id")
      .eq("customer_id", customerId);

    if (!error && data) {
      setCustomerProducts(data.map(cp => cp.product_id));
    }
  };

  const addProduct = (product: Product) => {
    const existing = orderItems.find(item => item.productId === product.id);
    if (existing) {
      setOrderItems(items => 
        items.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setOrderItems(items => [...items, {
        productId: product.id,
        articleCode: product.article_code,
        productName: product.name,
        quantity: 1,
      }]);
    }
    setProductOpen(false);
    setProductSearch("");
  };

  const updateQuantity = (productId: string, delta: number) => {
    setOrderItems(items => 
      items.map(item => {
        if (item.productId === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const removeItem = (productId: string) => {
    setOrderItems(items => items.filter(item => item.productId !== productId));
  };

  const generateOrderNumber = () => {
    const date = new Date();
    const prefix = "ORD";
    const timestamp = format(date, "yyyyMMddHHmmss");
    return `${prefix}-${timestamp}`;
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast.error("Selecteer een klant");
      return;
    }
    if (orderItems.length === 0) {
      toast.error("Voeg minimaal één product toe");
      return;
    }

    setSubmitting(true);

    try {
      // Get current user's profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niet ingelogd");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profiel niet gevonden");

      const orderNumber = generateOrderNumber();

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          delivery_date: deliveryDate ? format(deliveryDate, "yyyy-MM-dd") : null,
          notes: notes || null,
          created_by: profile.id,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const itemsToInsert = orderItems.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        article_code: item.articleCode,
        product_name: item.productName,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success(`Bestelling ${orderNumber} aangemaakt`);
      
      // Reset form
      setSelectedCustomer(null);
      setOrderItems([]);
      setDeliveryDate(undefined);
      setNotes("");

    } catch (error) {
      console.error("Order error:", error);
      toast.error("Fout bij aanmaken bestelling");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products - show customer's products first
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.article_code.toLowerCase().includes(productSearch.toLowerCase())
  );

  const customerFilteredProducts = filteredProducts.filter(p => customerProducts.includes(p.id));
  const otherProducts = filteredProducts.filter(p => !customerProducts.includes(p.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Nieuwe Bestelling
          </CardTitle>
          <CardDescription>
            Maak een nieuwe bestelling aan voor een klant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label>Klant *</Label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  className="w-full justify-between"
                >
                  {selectedCustomer ? selectedCustomer.name : "Selecteer klant..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Zoek klant..." />
                  <CommandList>
                    <CommandEmpty>Geen klanten gevonden.</CommandEmpty>
                    <CommandGroup>
                      {customers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={customer.name}
                          onSelect={() => {
                            setSelectedCustomer(customer);
                            setCustomerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            {customer.address && (
                              <div className="text-xs text-muted-foreground">{customer.address}</div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Delivery Date */}
          <div className="space-y-2">
            <Label>Leverdatum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deliveryDate ? format(deliveryDate, "d MMMM yyyy", { locale: nl }) : "Selecteer datum..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deliveryDate}
                  onSelect={setDeliveryDate}
                  locale={nl}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label>Producten toevoegen</Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Product toevoegen
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Zoek product..." 
                    value={productSearch}
                    onValueChange={setProductSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Geen producten gevonden.</CommandEmpty>
                    {selectedCustomer && customerFilteredProducts.length > 0 && (
                      <CommandGroup heading="Klant producten">
                        {customerFilteredProducts.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={`${product.article_code} ${product.name}`}
                            onSelect={() => addProduct(product)}
                          >
                            <Package className="mr-2 h-4 w-4" />
                            <div className="flex-1">
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs text-muted-foreground">{product.article_code}</div>
                            </div>
                            {product.category && (
                              <Badge variant="secondary" className="ml-2">{product.category}</Badge>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    <CommandGroup heading={selectedCustomer ? "Overige producten" : "Alle producten"}>
                      {(selectedCustomer ? otherProducts : filteredProducts).slice(0, 20).map((product) => (
                        <CommandItem
                          key={product.id}
                          value={`${product.article_code} ${product.name}`}
                          onSelect={() => addProduct(product)}
                        >
                          <Package className="mr-2 h-4 w-4" />
                          <div className="flex-1">
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-muted-foreground">{product.article_code}</div>
                          </div>
                          {product.category && (
                            <Badge variant="secondary" className="ml-2">{product.category}</Badge>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Order Items */}
          {orderItems.length > 0 && (
            <div className="space-y-2">
              <Label>Bestelregels</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Artikelcode</TableHead>
                    <TableHead className="text-center">Aantal</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.articleCode}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.productId, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.productId, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeItem(item.productId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Opmerkingen</Label>
            <Textarea
              placeholder="Eventuele opmerkingen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button 
            onClick={handleSubmit} 
            disabled={submitting || !selectedCustomer || orderItems.length === 0}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Bestelling aanmaken...
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Bestelling plaatsen
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
