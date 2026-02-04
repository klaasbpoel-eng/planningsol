import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Clock, Truck, CheckCircle2, FileDown, MapPin, Package, CalendarDays, FileText, User } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { generateOrderPDF } from "@/utils/generateOrderPDF";
import type { InternalOrder } from "@/hooks/useInternalOrders";
import type { Database } from "@/integrations/supabase/types";

type ProductionLocation = Database["public"]["Enums"]["production_location"];

interface OrderDetailDialogProps {
    order: InternalOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const getLocationLabel = (location: ProductionLocation) => {
    return location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg";
};

const StatusBadge = ({ status }: { status: string }) => {
    if (status === "pending") {
        return (
            <Badge variant="secondary" className="gap-1.5 text-sm py-1 px-3">
                <Clock className="h-3.5 w-3.5" /> In behandeling
            </Badge>
        );
    }
    if (status === "shipped") {
        return (
            <Badge className="bg-primary gap-1.5 text-sm py-1 px-3">
                <Truck className="h-3.5 w-3.5" /> Onderweg
            </Badge>
        );
    }
    if (status === "received") {
        return (
            <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400 gap-1.5 text-sm py-1 px-3">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ontvangen
            </Badge>
        );
    }
    return null;
};

export const OrderDetailDialog = ({ order, open, onOpenChange }: OrderDetailDialogProps) => {
    if (!order) return null;

    const handleDownloadPDF = () => {
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

    const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="font-mono text-lg">{order.order_number}</span>
                        <StatusBadge status={order.status} />
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Location Flow */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                        <div className="text-center">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                <MapPin className="h-4 w-4" />
                                Van
                            </div>
                            <div className="font-semibold">{getLocationLabel(order.from_location)}</div>
                        </div>
                        <div className="flex-1 flex justify-center">
                            <Truck className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                <MapPin className="h-4 w-4" />
                                Naar
                            </div>
                            <div className="font-semibold">{getLocationLabel(order.to_location)}</div>
                        </div>
                    </div>

                    {/* Order Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CalendarDays className="h-4 w-4" />
                                Aangemaakt op
                            </div>
                            <div className="font-medium">
                                {format(order.date, "EEEE d MMMM yyyy", { locale: nl })}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Package className="h-4 w-4" />
                                Totaal artikelen
                            </div>
                            <div className="font-medium">{totalItems} stuks</div>
                        </div>
                    </div>

                    <Separator />

                    {/* Items List */}
                    <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            Artikelen
                        </h4>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {order.items.map((item, index) => (
                                <div 
                                    key={index} 
                                    className="flex items-center justify-between p-3 bg-muted/20 rounded-md border"
                                >
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{item.articleName}</div>
                                        <div className="text-xs text-muted-foreground font-mono">
                                            Art. {item.articleId}
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="font-mono">
                                        {item.quantity}x
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notes Section */}
                    {order.notes && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h4 className="font-medium flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    Notities
                                </h4>
                                <div className="p-3 bg-muted/20 rounded-md border text-sm whitespace-pre-wrap">
                                    {order.notes}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end pt-2">
                        <Button onClick={handleDownloadPDF} variant="outline" className="gap-2">
                            <FileDown className="h-4 w-4" />
                            Download PDF
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
