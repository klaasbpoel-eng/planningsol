import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeftRight, Truck, Plus, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useInternalOrders } from "@/hooks/useInternalOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { ARTICLES } from "@/data/articles";
import { generateOrderPDF } from "@/utils/generateOrderPDF";
import { OrdersTable } from "@/components/internal-orders/OrdersTable";

type ProductionLocation = Database["public"]["Enums"]["production_location"];

interface OrderItem {
    articleId: string;
    articleName: string;
    quantity: number;
}

const InternalOrdersPage = () => {
    const [user, setUser] = useState<User | null>(null);
    const { role, productionLocation } = useUserPermissions(user?.id);

    // Form State
    const [fromLocation, setFromLocation] = useState<ProductionLocation>("sol_emmen");
    const [toLocation, setToLocation] = useState<ProductionLocation>("sol_tilburg");
    const [selectedArticle, setSelectedArticle] = useState<string>("");
    const [quantity, setQuantity] = useState<number>(1);
    const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
    const [activeTab, setActiveTab] = useState("incoming");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Database orders hook
    const {
        loading,
        createOrder,
        updateOrderStatus,
        getIncomingOrders,
        getOutgoingOrders
    } = useInternalOrders(productionLocation as ProductionLocation | null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });
    }, []);

    // Update logic when location permissions change
    // Requesting means: To = My Location, From = Other Location
    useEffect(() => {
        if (productionLocation) {
            setToLocation(productionLocation as ProductionLocation);
            setFromLocation(productionLocation === "sol_emmen" ? "sol_tilburg" : "sol_emmen");
        }
    }, [productionLocation]);


    // Sort and Group articles
    const articleGroups = useMemo(() => {
        const sorted = [...ARTICLES].sort((a, b) => a.name.localeCompare(b.name));

        const groups = [
            { heading: "2-Serie (Eigendom)", items: [] as typeof sorted },
            { heading: "7-Serie (Statiegeld/Huur)", items: [] as typeof sorted },
            { heading: "Overig", items: [] as typeof sorted }
        ];

        sorted.forEach(article => {
            if (article.id.startsWith("2")) {
                groups[0].items.push(article);
            } else if (article.id.startsWith("7")) {
                groups[1].items.push(article);
            } else {
                groups[2].items.push(article);
            }
        });

        // Filter out empty groups
        return groups.filter(g => g.items.length > 0);
    }, []);

    const addItem = () => {
        if (!selectedArticle || quantity <= 0) return;
        const article = ARTICLES.find(a => a.id === selectedArticle);
        if (!article) return;

        setCurrentOrderItems(prev => [
            ...prev,
            { articleId: article.id, articleName: article.name, quantity }
        ]);
        setSelectedArticle("");
        setQuantity(1);
    };

    const removeItem = (index: number) => {
        setCurrentOrderItems(prev => prev.filter((_, i) => i !== index));
    };

    const submitOrder = async () => {
        if (currentOrderItems.length === 0) return;

        setIsSubmitting(true);
        try {
            const newOrder = await createOrder(
                fromLocation,
                toLocation,
                currentOrderItems.map(item => ({
                    articleId: item.articleId,
                    articleName: item.articleName,
                    quantity: item.quantity
                }))
            );

            if (newOrder) {
                // Clear form
                setCurrentOrderItems([]);

                // Switch to INCOMING tab because we just REQUESTED an order TO us
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

    const LocationLabel = ({ value }: { value: string }) => {
        return value === "sol_emmen" ? <span>SOL Emmen</span> : <span>SOL Tilburg</span>;
    };

    const incomingOrders = getIncomingOrders();
    const outgoingOrders = getOutgoingOrders();

    return (
        <PageTransition>
            <div className="min-h-screen gradient-mesh">
                <Header userEmail={user?.email} role={role} />

                <main className="container mx-auto px-4 py-8">
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
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Van</Label>
                                            <div className="p-2 bg-muted/50 rounded-md font-medium text-sm border">
                                                <LocationLabel value={fromLocation} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Naar</Label>
                                            <div className="p-2 bg-muted/50 rounded-md font-medium text-sm border">
                                                <LocationLabel value={toLocation} />
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-3">
                                        <Label>Artikel Toevoegen</Label>
                                        <SearchableSelect
                                            groups={articleGroups.map(g => ({
                                                heading: g.heading,
                                                items: g.items.map(a => ({
                                                    value: a.id,
                                                    label: `[${a.id}] ${a.name}`
                                                }))
                                            }))}
                                            value={selectedArticle}
                                            onValueChange={setSelectedArticle}
                                            placeholder="Selecteer artikel (zoek op naam of nummer)..."
                                            searchPlaceholder="Zoek op artikelnummer of naam..."
                                        />

                                        <div className="flex gap-2">
                                            <div className="w-1/3">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={quantity}
                                                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                                />
                                            </div>
                                            <Button className="flex-1" variant="secondary" onClick={addItem} disabled={!selectedArticle}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Toevoegen
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Current Items List */}
                                    {currentOrderItems.length > 0 && (
                                        <div className="mt-4 border rounded-md overflow-hidden">
                                            <div className="bg-muted/50 p-2 text-xs font-medium text-muted-foreground border-b">
                                                Orderregels
                                            </div>
                                            <div className="max-h-[200px] overflow-y-auto">
                                                {currentOrderItems.map((item, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-2 text-sm border-b last:border-0 hover:bg-muted/20">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline">{item.quantity}x</Badge>
                                                            <span><span className="text-muted-foreground text-xs mr-2">[{item.articleId}]</span>{item.articleName}</span>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => removeItem(idx)}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        className="w-full mt-4"
                                        size="lg"
                                        onClick={submitOrder}
                                        disabled={currentOrderItems.length === 0 || isSubmitting}
                                    >
                                        {isSubmitting ? "Bezig..." : "Bestelling Plaatsen"}
                                    </Button>
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
