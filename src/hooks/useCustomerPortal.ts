import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomerUser {
  customer_id: string;
  customer_name: string;
  profile_id: string;
}

interface AssortmentProduct {
  id: string;
  product_id: string;
  warehouse: string | null;
  product: {
    id: string;
    article_code: string;
    name: string;
    description: string | null;
    category: string | null;
    size_liters: number | null;
    is_active: boolean;
    sort_order: number;
  };
}

interface CartItem {
  product_id: string;
  article_code: string;
  product_name: string;
  category: string | null;
  quantity: number;
}

export function useCustomerPortal(userId: string | undefined) {
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
  const [assortment, setAssortment] = useState<AssortmentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchCustomerData = async () => {
      try {
        // Get customer_users link
        const { data: cuData, error: cuError } = await supabase
          .from("customer_users")
          .select("customer_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (cuError) throw cuError;
        if (!cuData) {
          setLoading(false);
          return;
        }

        // Get customer name
        const { data: customerData } = await supabase
          .from("customers")
          .select("name")
          .eq("id", cuData.customer_id)
          .single();

        // Get profile id
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", userId)
          .single();

        setCustomerUser({
          customer_id: cuData.customer_id,
          customer_name: customerData?.name || "Klant",
          profile_id: profileData?.id || "",
        });

        // Get assortment
        const { data: assortmentData, error: assortmentError } = await supabase
          .from("customer_products")
          .select("id, product_id, warehouse, product:products(id, article_code, name, description, category, size_liters, is_active, sort_order)")
          .eq("customer_id", cuData.customer_id);

        if (assortmentError) throw assortmentError;

        // Filter active products and type-cast
        const activeAssortment = (assortmentData || [])
          .filter((item: any) => item.product?.is_active)
          .map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            warehouse: item.warehouse,
            product: item.product,
          })) as AssortmentProduct[];

        setAssortment(activeAssortment);
      } catch (error) {
        console.error("Error fetching customer data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [userId]);

  const updateQuantity = useCallback((productId: string, articleCode: string, productName: string, category: string | null, quantity: number) => {
    setCart(prev => {
      if (quantity <= 0) {
        return prev.filter(item => item.product_id !== productId);
      }
      const existing = prev.find(item => item.product_id === productId);
      if (existing) {
        return prev.map(item =>
          item.product_id === productId ? { ...item, quantity } : item
        );
      }
      return [...prev, { product_id: productId, article_code: articleCode, product_name: productName, category, quantity }];
    });
  }, []);

  const getQuantity = useCallback((productId: string) => {
    return cart.find(item => item.product_id === productId)?.quantity || 0;
  }, [cart]);

  const clearCart = useCallback(() => setCart([]), []);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const submitOrder = useCallback(async (notes: string, deliveryDate: string | null) => {
    if (!customerUser || cart.length === 0) return null;

    try {
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_id: customerUser.customer_id,
          customer_name: customerUser.customer_name,
          created_by: customerUser.profile_id,
          delivery_date: deliveryDate,
          notes: notes || null,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(
          cart.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            article_code: item.article_code,
            product_name: item.product_name,
            quantity: item.quantity,
          }))
        );

      if (itemsError) throw itemsError;

      clearCart();
      toast.success(`Bestelling ${orderNumber} is geplaatst!`);
      return orderNumber;
    } catch (error: any) {
      console.error("Error submitting order:", error);
      toast.error("Bestelling kon niet worden geplaatst: " + error.message);
      return null;
    }
  }, [customerUser, cart, clearCart]);

  return {
    customerUser,
    assortment,
    loading,
    cart,
    updateQuantity,
    getQuantity,
    clearCart,
    totalItems,
    submitOrder,
    isCustomer: !!customerUser,
  };
}

export function useCustomerOrders(userId: string | undefined) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Get profile id
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!profileData) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items:order_items(*)")
        .eq("created_by", profileData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, refetch: fetchOrders };
}
