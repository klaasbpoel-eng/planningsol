import { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { 
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { 
  Snowflake, 
  Building2, 
  Calendar, 
  Scale,
  Package,
  FileText,
  RotateCcw,
  CheckCircle2,
  Timer,
  XCircle,
  CircleDot
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type DryIceOrder = Database["public"]["Tables"]["dry_ice_orders"]["Row"];
type DryIceProductType = Database["public"]["Tables"]["dry_ice_product_types"]["Row"];
type DryIcePackaging = Database["public"]["Tables"]["dry_ice_packaging"]["Row"];

type DryIceOrderWithDetails = DryIceOrder & {
  product_type_info?: DryIceProductType | null;
  packaging_info?: DryIcePackaging | null;
};

interface DryIceOrderPreviewProps {
  children: ReactNode;
  order: DryIceOrderWithDetails;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export function DryIceOrderPreview({ 
  children, 
  order,
  side = "right",
  align = "center"
}: DryIceOrderPreviewProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
      case "pending": return <Timer className="h-3.5 w-3.5 text-warning" />;
      case "in_progress": return <CircleDot className="h-3.5 w-3.5 text-blue-500" />;
      case "cancelled": return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      default: return <Timer className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Voltooid";
      case "pending": return "Gepland";
      case "in_progress": return "Bezig";
      case "cancelled": return "Geannuleerd";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-warning/20 text-warning-foreground border-warning/30";
      case "in_progress": return "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30";
      case "completed": return "bg-success/20 text-success-foreground border-success/30";
      case "cancelled": return "bg-destructive/20 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground border-muted";
    }
  };

  const scheduledDate = parseISO(order.scheduled_date);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        side={side} 
        align={align}
        className="w-80 p-0 overflow-hidden border-border/50 bg-popover shadow-xl z-50"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/30 bg-cyan-500/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-background/50 rounded-lg backdrop-blur-sm">
              <Snowflake className="h-4 w-4 text-cyan-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate text-cyan-700 dark:text-cyan-300">
                Droogijs Order
              </h4>
              <p className="text-xs text-muted-foreground">{order.order_number}</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium">
              {getStatusIcon(order.status)}
              <span>{getStatusLabel(order.status)}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Customer */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted/50 rounded-lg">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Klant</p>
              <p className="text-sm font-medium">{order.customer_name}</p>
            </div>
          </div>

          {/* Scheduled date */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted/50 rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Datum</p>
              <p className="text-sm font-medium">
                {format(scheduledDate, "EEEE d MMMM yyyy", { locale: nl })}
              </p>
            </div>
          </div>

          {/* Weight and product type */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted/50 rounded-lg">
              <Scale className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gewicht & Type</p>
              <p className="text-sm font-medium">
                {order.quantity_kg} kg {order.product_type_info?.name || ""}
              </p>
            </div>
          </div>

          {/* Packaging */}
          {order.packaging_info && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Verpakking</p>
                <p className="text-sm font-medium">
                  {order.packaging_info.name}
                  {order.packaging_info.name?.toLowerCase().includes("container") && (
                    <span className="text-muted-foreground">
                      {" "}• {order.container_has_wheels ? "Met wielen" : "Zonder wielen"}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Badges section */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/30 flex-wrap">
            <Badge 
              variant="outline" 
              className={cn("text-xs", getStatusColor(order.status))}
            >
              {getStatusLabel(order.status)}
            </Badge>
            {order.is_recurring && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <RotateCcw className="h-3 w-3" />
                Herhalend
              </Badge>
            )}
          </div>

          {/* Notes if available */}
          {order.notes && (
            <div className="pt-2 border-t border-border/30">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Opmerkingen</p>
                  <p className="text-sm text-foreground/80 italic line-clamp-2">{order.notes}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
