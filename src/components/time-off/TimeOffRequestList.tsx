import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, differenceInDays } from "date-fns";
import { Calendar, Clock, Trash2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];

interface TimeOffRequestListProps {
  requests: TimeOffRequest[];
  onDelete: () => void;
}

export function TimeOffRequestList({ requests, onDelete }: TimeOffRequestListProps) {
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("time_off_requests")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Request deleted");
      onDelete();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-success/10 text-success border-success/20";
      case "rejected":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-warning/10 text-warning border-warning/20";
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "vacation":
        return "bg-primary/10 text-primary";
      case "sick":
        return "bg-destructive/10 text-destructive";
      case "personal":
        return "bg-accent/10 text-accent";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "vacation": return "Vacation";
      case "sick": return "Sick Leave";
      case "personal": return "Personal";
      default: return "Other";
    }
  };

  if (requests.length === 0) {
    return (
      <Card className="shadow-lg border-0">
        <CardContent className="pt-10 pb-10 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No time off requests yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Use the form above to submit your first request
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          Your Requests
        </CardTitle>
        <CardDescription>{requests.length} request{requests.length !== 1 ? 's' : ''} total</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((request) => {
          const days = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
          
          return (
            <div
              key={request.id}
              className="group relative p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("font-medium", getTypeStyles(request.type))}>
                      {getTypeLabel(request.type)}
                    </Badge>
                    <Badge variant="outline" className={cn("capitalize", getStatusStyles(request.status))}>
                      {request.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {format(new Date(request.start_date), "MMM d")} 
                      {request.start_date !== request.end_date && 
                        ` — ${format(new Date(request.end_date), "MMM d, yyyy")}`}
                      {request.start_date === request.end_date && 
                        `, ${format(new Date(request.start_date), "yyyy")}`}
                    </span>
                    <span className="text-muted-foreground">
                      ({days} day{days !== 1 ? 's' : ''})
                    </span>
                  </div>
                  
                  {request.reason && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {request.reason}
                    </p>
                  )}
                </div>
                
                {request.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(request.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
