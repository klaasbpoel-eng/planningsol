import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { useUserRole } from "@/hooks/useUserRole";

type ProductionLocation = Database["public"]["Enums"]["production_location"];

export interface InternalOrderItem {
    id?: string;
    articleId: string;
    articleName: string;
    quantity: number;
}

export interface InternalOrder {
    id: string;
    order_number: string;
    date: Date;
    from_location: ProductionLocation;
    to_location: ProductionLocation;
    items: InternalOrderItem[];
    status: "pending" | "shipped" | "received";
    notes?: string;
    created_by?: string;
}

interface DbInternalOrder {
    id: string;
    order_number: string;
    from_location: ProductionLocation;
    to_location: ProductionLocation;
    status: string;
    notes: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    items: {
        id: string;
        article_id: string;
        article_name: string;
        quantity: number;
    }[];
}

const generateOrderNumber = () => {
    const date = format(new Date(), "yyyyMMdd");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `INT-${date}-${random}`;
};

export const useInternalOrders = (productionLocation: ProductionLocation | null) => {
    const [orders, setOrders] = useState<InternalOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [profileId, setProfileId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | undefined>(undefined);
    const { isAdmin, loading: roleLoading } = useUserRole(userId);

    // Get user session and profile
    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .single();

                if (profile) {
                    setProfileId(profile.id);
                }
            }
        };
        fetchUserData();
    }, []);

    const fetchOrders = useCallback(async () => {
        // Allow admins to fetch all orders, others need a location
        if (!productionLocation && !isAdmin) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("internal_orders")
                .select(`
                    *,
                    items:internal_order_items(
                        id,
                        article_id,
                        article_name,
                        quantity
                    )
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const mappedOrders: InternalOrder[] = (data as DbInternalOrder[] || []).map(order => ({
                id: order.id,
                order_number: order.order_number,
                date: new Date(order.created_at),
                from_location: order.from_location,
                to_location: order.to_location,
                status: order.status as "pending" | "shipped" | "received",
                notes: order.notes || undefined,
                created_by: order.created_by,
                items: order.items.map(item => ({
                    id: item.id,
                    articleId: item.article_id,
                    articleName: item.article_name,
                    quantity: item.quantity
                }))
            }));

            setOrders(mappedOrders);
        } catch (error) {
            console.error("Error fetching internal orders:", error);
            toast.error("Kon interne bestellingen niet laden");
        } finally {
            setLoading(false);
        }
    }, [productionLocation, isAdmin]);

    useEffect(() => {
        if (roleLoading) return; // Wait for role check to complete
        fetchOrders();
    }, [fetchOrders, roleLoading]);

    // Set up realtime subscription
    useEffect(() => {
        if (!productionLocation && !isAdmin) return;

        const channel = supabase
            .channel("internal-orders-changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "internal_orders"
                },
                () => {
                    fetchOrders();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [productionLocation, isAdmin, fetchOrders]);

    const createOrder = async (
        fromLocation: ProductionLocation,
        toLocation: ProductionLocation,
        items: InternalOrderItem[],
        notes?: string
    ): Promise<InternalOrder | null> => {
        if (!profileId) {
            toast.error("Geen gebruikersprofiel gevonden");
            return null;
        }

        if (items.length === 0) {
            toast.error("Voeg minimaal één artikel toe");
            return null;
        }

        try {
            const orderNumber = generateOrderNumber();

            // Insert order
            const { data: orderData, error: orderError } = await supabase
                .from("internal_orders")
                .insert({
                    order_number: orderNumber,
                    from_location: fromLocation,
                    to_location: toLocation,
                    status: "pending",
                    notes: notes || null,
                    created_by: profileId
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // Insert items
            const { error: itemsError } = await supabase
                .from("internal_order_items")
                .insert(
                    items.map(item => ({
                        order_id: orderData.id,
                        article_id: item.articleId,
                        article_name: item.articleName,
                        quantity: item.quantity
                    }))
                );

            if (itemsError) throw itemsError;

            const newOrder: InternalOrder = {
                id: orderData.id,
                order_number: orderData.order_number,
                date: new Date(orderData.created_at),
                from_location: orderData.from_location,
                to_location: orderData.to_location,
                status: orderData.status as "pending" | "shipped" | "received",
                notes: orderData.notes || undefined,
                created_by: orderData.created_by,
                items
            };

            await fetchOrders();
            return newOrder;
        } catch (error) {
            console.error("Error creating order:", error);
            toast.error("Kon bestelling niet aanmaken");
            return null;
        }
    };

    const updateOrderStatus = async (
        orderId: string,
        newStatus: "pending" | "shipped" | "received"
    ): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from("internal_orders")
                .update({ status: newStatus })
                .eq("id", orderId);

            if (error) throw error;

            await fetchOrders();

            const statusLabels = {
                pending: "In behandeling",
                shipped: "Verzonden",
                received: "Ontvangen"
            };
            toast.success(`Status bijgewerkt naar "${statusLabels[newStatus]}"`);
            return true;
        } catch (error) {
            console.error("Error updating order status:", error);
            toast.error("Kon status niet bijwerken");
            return false;
        }
    };

    const getIncomingOrders = () => {
        // Admins see all orders, other users only see orders for their location
        if (isAdmin) {
            return orders;
        }
        if (!productionLocation) return [];
        return orders.filter(o => o.to_location === productionLocation);
    };

    const getOutgoingOrders = () => {
        // Admins see all orders, other users only see orders for their location
        if (isAdmin) {
            return orders;
        }
        if (!productionLocation) return [];
        return orders.filter(o => o.from_location === productionLocation);
    };

    const deleteOrder = async (orderId: string): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from("internal_orders")
                .delete()
                .eq("id", orderId);

            if (error) throw error;

            await fetchOrders();
            toast.success("Bestelling verwijderd");
            return true;
        } catch (error) {
            console.error("Error deleting order:", error);
            toast.error("Kon bestelling niet verwijderen");
            return false;
        }
    };

    const updateOrder = async (
        orderId: string,
        updates: {
            fromLocation?: ProductionLocation;
            toLocation?: ProductionLocation;
            items?: InternalOrderItem[];
            notes?: string;
            status?: "pending" | "shipped" | "received";
        }
    ): Promise<boolean> => {
        try {
            // Update order details
            const orderUpdates: any = {};
            if (updates.fromLocation) orderUpdates.from_location = updates.fromLocation;
            if (updates.toLocation) orderUpdates.to_location = updates.toLocation;
            if (updates.notes !== undefined) orderUpdates.notes = updates.notes;
            if (updates.status) orderUpdates.status = updates.status;

            if (Object.keys(orderUpdates).length > 0) {
                const { error: orderError } = await supabase
                    .from("internal_orders")
                    .update(orderUpdates)
                    .eq("id", orderId);

                if (orderError) throw orderError;
            }

            // Update items if provided
            if (updates.items) {
                // First delete existing items
                const { error: deleteError } = await supabase
                    .from("internal_order_items")
                    .delete()
                    .eq("order_id", orderId);

                if (deleteError) throw deleteError;

                // Insert new items
                if (updates.items.length > 0) {
                    const { error: itemsError } = await supabase
                        .from("internal_order_items")
                        .insert(
                            updates.items.map(item => ({
                                order_id: orderId,
                                article_id: item.articleId,
                                article_name: item.articleName,
                                quantity: item.quantity
                            }))
                        );

                    if (itemsError) throw itemsError;
                }
            }

            await fetchOrders();
            toast.success("Bestelling bijgewerkt");
            return true;
        } catch (error) {
            console.error("Error updating order:", error);
            toast.error("Kon bestelling niet bijwerken");
            return false;
        }
    };

    return {
        orders,
        loading,
        createOrder,
        updateOrderStatus,
        deleteOrder,
        updateOrder,
        getIncomingOrders,
        getOutgoingOrders,
        refreshOrders: fetchOrders
    };
};
