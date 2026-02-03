import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit2, Trash2, Repeat, Calendar, Package } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface BaseOrderCardProps {
  id: string;
  customerName: string;
  scheduledDate: string;
  status: string;
  onStatusChange?: (id: string, status: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  children: React.ReactNode;
  statusLabels?: Record<string, string>;
  isRecurring?: boolean;
}

const defaultStatusLabels: Record<string, string> = {
  pending: "Gepland",
  in_progress: "Bezig",
  completed: "Voltooid",
  cancelled: "Geannuleerd",
};

export function MobileOrderCard({
  id,
  customerName,
  scheduledDate,
  status,
  onStatusChange,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
  children,
  statusLabels = defaultStatusLabels,
  isRecurring = false,
}: BaseOrderCardProps) {
  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      in_progress: "default",
      completed: "outline",
      cancelled: "destructive",
    };
    return variants[status] || "secondary";
  };

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-3">
        {/* Header: Customer & Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium truncate">{customerName}</h4>
              {isRecurring && (
                <Repeat className="h-3.5 w-3.5 text-cyan-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(scheduledDate), "d MMM yyyy", { locale: nl })}
            </div>
          </div>
          
          {/* Status Badge or Select */}
          {canEdit && onStatusChange ? (
            <Select 
              value={status} 
              onValueChange={(v) => onStatusChange(id, v)}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={getStatusVariant(status)}>
              {statusLabels[status] || status}
            </Badge>
          )}
        </div>

        {/* Order Details (passed as children) */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {children}
        </div>

        {/* Actions */}
        {(canEdit || canDelete) && (
          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            {canEdit && onEdit && (
              <Button 
                variant="ghost" 
                size="sm"
                className="h-9"
                onClick={onEdit}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Bewerken
              </Button>
            )}
            {canDelete && onDelete && (
              <Button 
                variant="ghost" 
                size="sm"
                className="h-9 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Verwijderen
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper component for order detail items
interface OrderDetailProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function OrderDetail({ label, value, className }: OrderDetailProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
