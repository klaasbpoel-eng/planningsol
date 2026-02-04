import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Truck, CheckCircle2, Clock, FileDown, Send, PackageCheck } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { generateOrderPDF } from "@/utils/generateOrderPDF";
import type { InternalOrder } from "@/hooks/useInternalOrders";
import type { Database } from "@/integrations/supabase/types";

type ProductionLocation = Database["public"]["Enums"]["production_location"];

interface OrdersTableProps {
    orders: InternalOrder[];
    type: "incoming" | "outgoing";
    productionLocation: ProductionLocation | null;
    onUpdateStatus: (orderId: string, status: "pending" | "shipped" | "received") => Promise<boolean>;
    loading?: boolean;
}

const getLocationLabel = (location: ProductionLocation) => {
    return location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg";
};

export const OrdersTable = ({ orders, type, productionLocation, onUpdateStatus, loading }: OrdersTableProps) => {
    const handleDownloadPDF = (order: InternalOrder) => {
        generateOrderPDF({
            id: order.id,
            order_number: order.order_number,
            date: order.date,
            from: order.from_location,
            to: order.to_location,
            items: order.items,
            status: order.status
        });
    };

    if (loading) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                <p>Laden...</p>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>Geen {type === "incoming" ? "inkomende" : "uitgaande"} bestellingen gevonden.</p>
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>{type === "incoming" ? "Van" : "Naar"}</TableHead>
                    <TableHead>Artikelen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {orders.map(order => (
                    <TableRow key={order.id}>
                        <TableCell className="font-mono font-medium text-xs">
                            {order.order_number}
                        </TableCell>
                        <TableCell>
                            {format(order.date, "d MMM yyyy", { locale: nl })}
                        </TableCell>
                        <TableCell>
                            {type === "incoming"
                                ? getLocationLabel(order.from_location)
                                : getLocationLabel(order.to_location)
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
                            {order.status === "pending" && (
                                <Badge variant="secondary" className="gap-1">
                                    <Clock className="h-3 w-3" /> In behandeling
                                </Badge>
                            )}
                            {order.status === "shipped" && (
                                <Badge className="bg-primary gap-1">
                                    <Truck className="h-3 w-3" /> Onderweg
                                </Badge>
                            )}
                            {order.status === "received" && (
                                <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400 gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Ontvangen
                                </Badge>
                            )}
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center justify-end gap-2">
                                {/* Status update buttons based on context */}
                                {type === "outgoing" && order.status === "pending" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onUpdateStatus(order.id, "shipped")}
                                        className="text-primary hover:text-primary/80"
                                    >
                                        <Send className="h-3 w-3 mr-1" />
                                        Verzenden
                                    </Button>
                                )}
                                {type === "incoming" && order.status === "shipped" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onUpdateStatus(order.id, "received")}
                                        className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                                    >
                                        <PackageCheck className="h-3 w-3 mr-1" />
                                        Ontvangen
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownloadPDF(order)}
                                    title="Download PDF"
                                >
                                    <FileDown className="h-4 w-4" />
                                </Button>
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};
