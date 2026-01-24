import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, differenceInDays } from "date-fns";
import { Calendar, Check, X, Clock, User, Loader2, Plus, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RequestFormDialog } from "./RequestFormDialog";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type RequestStatus = Database["public"]["Enums"]["request_status"];

interface RequestWithProfile extends TimeOffRequest {
  profiles?: Profile | null;
}

interface AdminRequestListProps {
  requests: RequestWithProfile[];
  onUpdate: () => void;
}

export function AdminRequestList({ requests, onUpdate }: AdminRequestListProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestWithProfile | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<RequestWithProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });
      setEmployees(data || []);
    };
    fetchEmployees();
  }, []);

  const handleStatusUpdate = async (id: string, status: RequestStatus) => {
    setUpdating(id);
    try {
      const { error } = await supabase
        .from("time_off_requests")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Aanvraag ${status === "approved" ? "goedgekeurd" : "afgewezen"}`);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleCreateRequest = () => {
    setSelectedRequest(null);
    setFormMode("create");
    setFormDialogOpen(true);
  };

  const handleEditRequest = (request: RequestWithProfile) => {
    setSelectedRequest(request);
    setFormMode("edit");
    setFormDialogOpen(true);
  };

  const handleDeleteClick = (request: RequestWithProfile) => {
    setRequestToDelete(request);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!requestToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("time_off_requests")
        .delete()
        .eq("id", requestToDelete.id);

      if (error) throw error;
      toast.success("Aanvraag verwijderd");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
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
      case "vacation": return "Vakantie";
      case "sick": return "Ziekteverlof";
      case "personal": return "Persoonlijk";
      default: return "Overig";
    }
  };

  const pendingRequests = requests.filter(r => r.status === "pending");
  const processedRequests = requests.filter(r => r.status !== "pending");

  const RequestActions = ({ request }: { request: RequestWithProfile }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover z-50">
        <DropdownMenuItem onClick={() => handleEditRequest(request)}>
          <Edit className="h-4 w-4 mr-2" />
          Bewerken
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => handleDeleteClick(request)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Verwijderen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={handleCreateRequest} className="gap-2">
          <Plus className="h-4 w-4" />
          Aanvraag Maken
        </Button>
      </div>

      {/* Pending Requests */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-warning" />
            In Behandeling
          </CardTitle>
          <CardDescription>
            {pendingRequests.length} aanvra{pendingRequests.length !== 1 ? 'gen' : 'ag'} wachtend op goedkeuring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Geen aanvragen in behandeling</p>
          ) : (
            pendingRequests.map((request) => {
              const days = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
              const isUpdating = updating === request.id;
              
              return (
                <div
                  key={request.id}
                  className="p-4 rounded-xl bg-warning/5 border border-warning/10"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span className="font-medium text-foreground">
                          {request.profiles?.full_name || request.profiles?.email || "Onbekende Medewerker"}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("font-medium", getTypeStyles(request.type))}>
                          {getTypeLabel(request.type)}
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
                          ({days} dag{days !== 1 ? 'en' : ''})
                        </span>
                      </div>
                      
                      {request.reason && (
                        <p className="text-sm text-muted-foreground">
                          {request.reason}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-success hover:bg-success/90 text-success-foreground"
                        onClick={() => handleStatusUpdate(request.id, "approved")}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Goedkeuren
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleStatusUpdate(request.id, "rejected")}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <X className="h-4 w-4 mr-1" />
                            Afwijzen
                          </>
                        )}
                      </Button>
                      <RequestActions request={request} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Processed Requests */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Alle Aanvragen
          </CardTitle>
          <CardDescription>
            {processedRequests.length} verwerkte aanvra{processedRequests.length !== 1 ? 'gen' : 'ag'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {processedRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nog geen verwerkte aanvragen</p>
          ) : (
            processedRequests.map((request) => {
              const days = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
              
              return (
                <div
                  key={request.id}
                  className="p-4 rounded-xl bg-muted/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span className="font-medium text-foreground">
                          {request.profiles?.full_name || request.profiles?.email || "Onbekende Medewerker"}
                        </span>
                      </div>
                      
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
                        <span>
                          {format(new Date(request.start_date), "MMM d")} 
                          {request.start_date !== request.end_date && 
                            ` — ${format(new Date(request.end_date), "MMM d, yyyy")}`}
                          {request.start_date === request.end_date && 
                            `, ${format(new Date(request.start_date), "yyyy")}`}
                        </span>
                        <span className="text-muted-foreground">
                          ({days} dag{days !== 1 ? 'en' : ''})
                        </span>
                      </div>
                    </div>
                    
                    <RequestActions request={request} />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Request Form Dialog */}
      <RequestFormDialog
        request={selectedRequest}
        employees={employees}
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        onUpdate={onUpdate}
        mode={formMode}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aanvraag Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet u zeker dat u deze verlofaanvraag wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
