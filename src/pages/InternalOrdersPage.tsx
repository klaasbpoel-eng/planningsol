import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeftRight, Truck } from "lucide-react";
import { useInternalOrders } from "@/hooks/useInternalOrders";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PageLayout } from "@/components/layout/PageLayout";

import { generateOrderPDF } from "@/utils/generateOrderPDF";
import { OrdersTable } from "@/components/internal-orders/OrdersTable";
import { InternalOrderForm, InternalOrderFormData } from "@/components/internal-orders/InternalOrderForm";

type ProductionLocation = Database["public"]["Enums"]["production_location"];

const InternalOrdersPage = () => (
  <ProtectedRoute>
    {({ user, role, productionLocation }) => (
      <InternalOrdersContent
        userEmail={user.email}
        role={role}
        productionLocation={productionLocation as ProductionLocation | null}
      />
    )}
  </ProtectedRoute>
);

function InternalOrdersContent({
  userEmail,
  role,
  productionLocation,
}: {
  userEmail?: string;
  role: string;
  productionLocation: ProductionLocation | null;
}) {
  const [activeTab, setActiveTab] = useState("incoming");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    loading,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    updateOrder,
    getIncomingOrders,
    getOutgoingOrders,
  } = useInternalOrders(productionLocation);

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
        setActiveTab("incoming");
        try {
          generateOrderPDF({
            id: newOrder.id,
            order_number: newOrder.order_number,
            date: newOrder.date,
            from: newOrder.from_location,
            to: newOrder.to_location,
            items: newOrder.items,
            status: newOrder.status,
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
      notes: data.notes,
    });
  };

  const incomingOrders = getIncomingOrders();
  const outgoingOrders = getOutgoingOrders();

  return (
    <PageLayout
      userEmail={userEmail}
      role={role as any}
      title="Interne Bestellingen"
      description="Beheer goederenstromen tussen Emmen en Tilburg"
      titleIcon={<ArrowLeftRight className="h-8 w-8 text-primary" />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                defaultToLocation={productionLocation || "sol_tilburg"}
                onSubmit={handleCreateOrder}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        </div>

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
    </PageLayout>
  );
}

export default InternalOrdersPage;
