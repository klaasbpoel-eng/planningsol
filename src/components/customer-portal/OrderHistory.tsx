import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useCustomerOrders } from "@/hooks/useCustomerPortal";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "In behandeling", variant: "secondary" },
  confirmed: { label: "Bevestigd", variant: "default" },
  processing: { label: "In verwerking", variant: "default" },
  completed: { label: "Afgerond", variant: "outline" },
  cancelled: { label: "Geannuleerd", variant: "destructive" },
};

interface OrderHistoryProps {
  userId: string;
}

export function OrderHistory({ userId }: OrderHistoryProps) {
  const { orders, loading } = useCustomerOrders(userId);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        variant="orders"
        title="Nog geen bestellingen"
        description="Je hebt nog geen bestellingen geplaatst."
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map(order => {
        const isExpanded = expandedOrder === order.id;
        const status = STATUS_MAP[order.status] || STATUS_MAP.pending;
        const itemCount = order.order_items?.length || 0;

        return (
          <Card
            key={order.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-sm font-mono">{order.order_number}</CardTitle>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{format(parseISO(order.created_at), "d MMM yyyy", { locale: nl })}</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {itemCount} {itemCount === 1 ? "artikel" : "artikelen"}
                {order.delivery_date && (
                  <> · Levering: {format(parseISO(order.delivery_date), "d MMM yyyy", { locale: nl })}</>
                )}
              </p>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <div className="border-t pt-3 space-y-2">
                  {order.order_items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div>
                        <span className="font-medium">{item.product_name}</span>
                        <span className="text-muted-foreground ml-2 font-mono text-xs">{item.article_code}</span>
                      </div>
                      <Badge variant="secondary">{item.quantity}x</Badge>
                    </div>
                  ))}
                  {order.notes && (
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Opmerking:</span> {order.notes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
