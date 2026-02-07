import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeftRight, Truck } from "lucide-react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useInternalOrders } from "@/hooks/useInternalOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { generateOrderPDF } from "@/utils/generateOrderPDF";
import { OrdersTable } from "@/components/internal-orders/OrdersTable";
import { InternalOrderForm, InternalOrderFormData } from "@/components/internal-orders/InternalOrderForm";

type ProductionLocation = Database["public"]["Enums"]["production_location"];

const InternalOrdersPage = () => {
    const [user, setUser] = useState<User | null>(null);
    const { role, productionLocation } = useUserPermissions(user?.id);
    const [activeTab, setActiveTab] = useState("incoming");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Database orders hook
    const {
        loading,
        createOrder,
        updateOrderStatus,
        deleteOrder,
        updateOrder,
        getIncomingOrders,
        getOutgoingOrders
    } = useInternalOrders(productionLocation as ProductionLocation | null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });
    }, []);

    const handleCreateOrder = async (data: InternalOrderFormData) => {
        setIsSubmitting(true);
        try {
            const newOrder = await createOrder(
                data.fromLocation,
                data.toLocation,
                data.items,
                data.notes.trim() || undefined
            );

            if (newOrder) {
                // Switch to INCOMING tab because we just REQUESTED an order TO us (usually)
                setActiveTab("incoming");

                // Generate PDF
                try {
                    generateOrderPDF({
                        id: newOrder.id,
                        order_number: newOrder.order_number,
                        date: newOrder.date,
                        from: newOrder.from_location,
                        to: newOrder.to_location,
                        items: newOrder.items,
                        status: newOrder.status
                    });
                    toast.success("Interne bestelling geplaatst en PDF gedownload!");
                } catch (error) {
                    console.error("PDF generation failed:", error);
                    toast.success("Bestelling geplaatst!");
                    toast.error("PDF generatie mislukt.");
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateOrder = async (orderId: string, data: InternalOrderFormData): Promise<boolean> => {
        return await updateOrder(orderId, {
            fromLocation: data.fromLocation,
            toLocation: data.toLocation,
            items: data.items,
            notes: data.notes
        });
    };

    const incomingOrders = getIncomingOrders();
    const outgoingOrders = getOutgoingOrders();

    return (
        <PageTransition>
            <div className="min-h-screen gradient-mesh">
                <Header userEmail={user?.email} role={role} />

                <main className="w-full px-4 md:px-[10%] py-8">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gradient flex items-center gap-3">
                                <ArrowLeftRight className="h-8 w-8 text-primary" />
                                Interne Bestellingen
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Beheer goederenstromen tussen Emmen en Tilburg
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Order Form */}
                        <div className="lg:col-span-1 space-y-6">
                            <Card className="glass-card sticky top-24">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Truck className="h-5 w-5 text-orange-500" />
                                        Nieuwe Bestelling
                                    </CardTitle>
                                    <CardDescription>Maak een nieuwe verplaatsingsorder aan</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <InternalOrderForm
                                        defaultFromLocation={productionLocation === "sol_emmen" ? "sol_tilburg" : "sol_emmen"}
                                        defaultToLocation={productionLocation as ProductionLocation || "sol_tilburg"}
                                        onSubmit={handleCreateOrder}
                                        isSubmitting={isSubmitting}
                                    />
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: Order History / Dashboard */}
                        <div className="lg:col-span-2">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="incoming">
                                        Inkomend (Naar {productionLocation === "sol_emmen" ? "Emmen" : "Tilburg"})
                                    </TabsTrigger>
                                    <TabsTrigger value="outgoing">
                                        Uitgaand (Van {productionLocation === "sol_emmen" ? "Emmen" : "Tilburg"})
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="incoming" className="mt-4">
                                    <Card className="glass-card">
                                        <CardHeader>
                                            <CardTitle>Inkomende Bestellingen</CardTitle>
                                            <CardDescription>Orders die onderweg zijn naar jouw locatie</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <OrdersTable
                                                orders={incomingOrders}
                                                type="incoming"
                                                productionLocation={productionLocation as ProductionLocation}
                                                onUpdateStatus={updateOrderStatus}
                                                loading={loading}
                                                isAdmin={role === "admin"}
                                                onDelete={deleteOrder}
                                                onUpdate={handleUpdateOrder}
                                            />
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="outgoing" className="mt-4">
                                    <Card className="glass-card">
                                        <CardHeader>
                                            <CardTitle>Uitgaande Bestellingen</CardTitle>
                                            <CardDescription>Orders die jij hebt geplaatst voor verzending</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <OrdersTable
                                                orders={outgoingOrders}
                                                type="outgoing"
                                                productionLocation={productionLocation as ProductionLocation}
                                                onUpdateStatus={updateOrderStatus}
                                                loading={loading}
                                                isAdmin={role === "admin"}
                                                onDelete={deleteOrder}
                                                onUpdate={handleUpdateOrder}
                                            />
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </main>
            </div>
        </PageTransition>
    );
};

export default InternalOrdersPage;
