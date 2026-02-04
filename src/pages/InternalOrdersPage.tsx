import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeftRight, Truck, Package, Plus, Trash2, CheckCircle2, Clock } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

import { ARTICLES } from "@/data/articles";
import { generateOrderPDF } from "@/utils/generateOrderPDF";

interface OrderItem {
    articleId: string;
    articleName: string;
    quantity: number;
}

interface InternalOrder {
    id: string;
    date: Date;
    from: string;
    to: string;
    items: OrderItem[];
    status: "pending" | "shipped" | "received";
}

const InternalOrdersPage = () => {
    const [user, setUser] = useState<User | null>(null);
    const { role, productionLocation } = useUserPermissions(user?.id);

    // Form State
    const [fromLocation, setFromLocation] = useState<string>("sol_emmen");
    const [toLocation, setToLocation] = useState<string>("sol_tilburg");
    const [selectedArticle, setSelectedArticle] = useState<string>("");
    const [quantity, setQuantity] = useState<number>(1);
    const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
    const [activeTab, setActiveTab] = useState("incoming");

    // State for orders (Restored mock data for history visibility)
    const [orders, setOrders] = useState<InternalOrder[]>([
        {
            id: "ORD-2024-001",
            date: new Date(2024, 1, 28, 14, 30),
            from: "sol_tilburg",
            to: "sol_emmen",
            items: [
                { articleId: "250200", articleName: "Stikstof 4.8 (20L)", quantity: 5 },
                { articleId: "710250", articleName: "Stikstof 5.0 (10L)", quantity: 2 }
            ],
            status: "received"
        },
        {
            id: "ORD-2024-002",
            date: new Date(2024, 2, 10, 9, 15),
            from: "sol_emmen",
            to: "sol_tilburg",
            items: [
                { articleId: "90450", articleName: "Droogijs (3mm)", quantity: 20 }
            ],
            status: "shipped"
        }
    ]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });
    }, []);

    // Update logic when location permissions change
    // Update logic when location permissions change
    // Requesting means: To = My Location, From = Other Location
    useEffect(() => {
        if (productionLocation) {
            setToLocation(productionLocation);
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

    const submitOrder = () => {
        if (currentOrderItems.length === 0) return;

        const newOrder: InternalOrder = {
            id: `ORD-${Math.floor(Math.random() * 10000)}`,
            date: new Date(),
            from: fromLocation,
            to: toLocation,
            items: [...currentOrderItems],
            status: "pending"
        };

        // Switch to INCOMING tab because we just REQUESTED an order TO us
        setActiveTab("incoming");

        // Generate PDF
        try {
            generateOrderPDF(newOrder);
            toast.success("Interne bestelling geplaatst en PDF gedownload!");
        } catch (error) {
            console.error("PDF generation failed:", error);
            toast.error("Bestelling geplaatst, maar PDF generatie mislukt.");
        }
    };

    const LocationLabel = ({ value }: { value: string }) => {
        return value === "sol_emmen" ? <span>SOL Emmen</span> : <span>SOL Tilburg</span>;
    };

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
                                        disabled={currentOrderItems.length === 0}
                                    >
                                        Bestelling Plaatsen
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: Order History / Dashboard */}
                        <div className="lg:col-span-2">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="incoming">Inkomend (Naar {productionLocation === 'sol_emmen' ? 'Emmen' : 'Tilburg'})</TabsTrigger>
                                    <TabsTrigger value="outgoing">Uitgaand (Van {productionLocation === 'sol_emmen' ? 'Emmen' : 'Tilburg'})</TabsTrigger>
                                </TabsList>

                                <TabsContent value="incoming" className="mt-4">
                                    <Card className="glass-card">
                                        <CardHeader>
                                            <CardTitle>Inkomende Bestellingen</CardTitle>
                                            <CardDescription>Orders die onderweg zijn naar jouw locatie</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <OrdersTable orders={orders.filter(o => o.to === productionLocation)} type="incoming" />
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
                                            <OrdersTable orders={orders.filter(o => o.from === productionLocation)} type="outgoing" />
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

// Helper Component for Orders Table
const OrdersTable = ({ orders, type }: { orders: InternalOrder[], type: 'incoming' | 'outgoing' }) => {
    if (orders.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>Geen {type === 'incoming' ? 'inkomende' : 'uitgaande'} bestellingen gevonden.</p>
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>{type === 'incoming' ? 'Van' : 'Naar'}</TableHead>
                    <TableHead>Artikelen</TableHead>
                    <TableHead>Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {orders.map(order => (
                    <TableRow key={order.id}>
                        <TableCell className="font-mono font-medium">{order.id}</TableCell>
                        <TableCell>{format(order.date, 'd MMM yyyy', { locale: nl })}</TableCell>
                        <TableCell>
                            {type === 'incoming'
                                ? (order.from === 'sol_emmen' ? 'SOL Emmen' : 'SOL Tilburg')
                                : (order.to === 'sol_emmen' ? 'SOL Emmen' : 'SOL Tilburg')
                            }
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col gap-1">
                                {order.items.map((item, i) => (
                                    <span key={i} className="text-xs">
                                        <b className="text-foreground">{item.quantity}x</b> {item.articleName}
                                    </span>
                                ))}
                            </div>
                        </TableCell>
                        <TableCell>
                            {order.status === 'pending' && <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> In behandeling</Badge>}
                            {order.status === 'shipped' && <Badge className="bg-blue-500 gap-1"><Truck className="h-3 w-3" /> Onderweg</Badge>}
                            {order.status === 'received' && <Badge variant="outline" className="border-green-500 text-green-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Ontvangen</Badge>}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default InternalOrdersPage;
