import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InternalOrderForm, InternalOrderFormData } from "./InternalOrderForm";
import type { InternalOrder } from "@/hooks/useInternalOrders";

interface EditOrderDialogProps {
    order: InternalOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate: (orderId: string, data: InternalOrderFormData) => Promise<void>;
}

export const EditOrderDialog = ({ order, open, onOpenChange, onUpdate }: EditOrderDialogProps) => {
    if (!order) return null;

    const handleSubmit = async (data: InternalOrderFormData) => {
        await onUpdate(order.id, data);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Bestelling Bewerken: {order.order_number}</DialogTitle>
                </DialogHeader>
                <InternalOrderForm
                    initialData={{
                        fromLocation: order.from_location,
                        toLocation: order.to_location,
                        items: order.items,
                        notes: order.notes || ""
                    }}
                    onSubmit={handleSubmit}
                    submitLabel="Opslaan"
                />
            </DialogContent>
        </Dialog>
    );
};
