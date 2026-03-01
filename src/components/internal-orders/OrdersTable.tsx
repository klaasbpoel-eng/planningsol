import { useState } from "react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Truck, CheckCircle2, Clock, FileDown, Send, PackageCheck, Eye, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { generateOrderPDF } from "@/utils/generateOrderPDF";
import { OrderDetailDialog } from "./OrderDetailDialog";
import { EditOrderDialog } from "./EditOrderDialog";
import type { InternalOrder } from "@/hooks/useInternalOrders";
import type { Database } from "@/integrations/supabase/types";
import { InternalOrderFormData } from "./InternalOrderForm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type ProductionLocation = Database["public"]["Enums"]["production_location"];

interface OrdersTableProps {
    orders: InternalOrder[];
    type: "incoming" | "outgoing";
    productionLocation: ProductionLocation | null;
    onUpdateStatus: (orderId: string, status: "pending" | "shipped" | "received") => Promise<boolean>;
    loading?: boolean;
    isAdmin?: boolean;
    onDelete?: (orderId: string) => Promise<boolean>;
    onUpdate?: (orderId: string, data: InternalOrderFormData) => Promise<boolean>;
}

const getLocationLabel = (location: ProductionLocation) => {
    return location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg";
};

export const OrdersTable = ({ orders, type, productionLocation, onUpdateStatus, loading, isAdmin, onDelete, onUpdate }: OrdersTableProps) => {
    const [selectedOrder, setSelectedOrder] = useState<InternalOrder | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);

    // Edit & delete state
    const [editOrder, setEditOrder] = useState<InternalOrder | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteOrder, setDeleteOrder] = useState<InternalOrder | null>(null);
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

    const handleViewDetails = (order: InternalOrder) => {
        setSelectedOrder(order);
        setDetailDialogOpen(true);
    };

    const handleEdit = (order: InternalOrder, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditOrder(order);
        setEditDialogOpen(true);
    };

    const handleDeleteClick = (order: InternalOrder, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteOrder(order);
        setDeleteAlertOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (deleteOrder && onDelete) {
            await onDelete(deleteOrder.id);
            setDeleteAlertOpen(false);
            setDeleteOrder(null);
        }
    };

    const handleUpdateOrder = async (orderId: string, data: InternalOrderFormData) => {
        if (onUpdate) {
            await onUpdate(orderId, data);
        }
    };

    const handleDownloadPDF = (order: InternalOrder) => {
        generateOrderPDF({
            id: order.id,
            order_number: order.order_number,
            date: order.date,
            from: order.from_location,
            to: order.to_location,
            items: order.items,
            status: order.status,
            notes: order.notes
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
        <>
            <div className="overflow-x-auto -mx-2 px-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="whitespace-nowrap">Order #</TableHead>
                        <TableHead className="whitespace-nowrap">Datum</TableHead>
                        <TableHead className="whitespace-nowrap">{type === "incoming" ? "Van" : "Naar"}</TableHead>
                        <TableHead>Artikelen</TableHead>
                        <TableHead className="hidden md:table-cell">Notities</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map(order => (
                        <TableRow
                            key={order.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleViewDetails(order)}
                        >
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
                                    {order.items.slice(0, 2).map((item, i) => (
                                        <span key={i} className="text-xs">
                                            <b className="text-foreground">{item.quantity}x</b> {item.articleName}
                                        </span>
                                    ))}
                                    {order.items.length > 2 && (
                                        <span className="text-xs text-muted-foreground">
                                            +{order.items.length - 2} meer...
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                {order.notes ? (
                                    <span className="text-xs text-muted-foreground line-clamp-2 max-w-[200px]">{order.notes}</span>
                                ) : (
                                    <span className="text-xs text-muted-foreground/50">—</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1.5">
                                    {/* Step indicator */}
                                    <div className="flex items-center gap-0.5">
                                        <Package className={cn("h-3.5 w-3.5", order.status === "pending" ? "text-warning" : "text-muted-foreground/40")} />
                                        <div className={cn("w-4 h-0.5 rounded-full", order.status !== "pending" ? "bg-primary" : "bg-muted")} />
                                        <Truck className={cn("h-3.5 w-3.5", order.status === "shipped" ? "text-primary" : "text-muted-foreground/40")} />
                                        <div className={cn("w-4 h-0.5 rounded-full", order.status === "received" ? "bg-emerald-500" : "bg-muted")} />
                                        <CheckCircle2 className={cn("h-3.5 w-3.5", order.status === "received" ? "text-emerald-500" : "text-muted-foreground/40")} />
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                    {/* Admin Actions */}
                                    {isAdmin && (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => handleEdit(order, e)}
                                                className="h-8 w-8 p-0"
                                            >
                                                <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => handleDeleteClick(order, e)}
                                                className="h-8 w-8 p-0"
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive hover:text-red-700" />
                                            </Button>
                                        </>
                                    )}

                                    {/* Status update buttons based on context */}
                                    {(type === "outgoing" && order.status === "pending" && !isAdmin) && (
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
                                    {(type === "incoming" && order.status === "shipped" && !isAdmin) && (
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
            </div>

            <OrderDetailDialog
                order={selectedOrder}
                open={detailDialogOpen}
                onOpenChange={setDetailDialogOpen}
            />

            <EditOrderDialog
                order={editOrder}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onUpdate={handleUpdateOrder}
            />

            <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dit zal bestelling <b>{deleteOrder?.order_number}</b> permanent verwijderen. Deze actie kan niet ongedaan worden gemaakt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Verwijderen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};