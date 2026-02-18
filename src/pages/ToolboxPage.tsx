import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, BookOpen, FileText, Plus, Pencil, Trash2, Copy, MoreVertical, Clock, AlertTriangle, CheckCircle2, Send, Archive, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLayout } from "@/components/layout/PageLayout";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { toast } from "sonner";
import type { ToolboxItem, ToolboxStatus } from "@/hooks/useToolbox";
import { useToolboxes, deleteToolbox, duplicateToolbox, saveToolbox } from "@/hooks/useToolbox";
import { ToolboxEditorDialog } from "@/components/toolbox/ToolboxEditorDialog";
import { ToolboxViewer } from "@/components/toolbox/ToolboxViewer";

const STATUS_CONFIG: Record<ToolboxStatus, { label: string; variant: "default" | "secondary" | "outline"; icon: React.ReactNode }> = {
  draft: { label: "Concept", variant: "secondary", icon: <Pencil className="h-3 w-3" /> },
  published: { label: "Gepubliceerd", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  archived: { label: "Gearchiveerd", variant: "outline", icon: <Archive className="h-3 w-3" /> },
};

const ToolboxPage = () => {
  const [session, setSession] = useState<any>(null);
  const { isAdmin, role } = useUserPermissions(session?.user?.id);
  const canManage = isAdmin || role === "supervisor";

  const { toolboxes, loading, refetch } = useToolboxes(canManage);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ToolboxStatus>("all");

  // Completions for current user
  const [userCompletions, setUserCompletions] = useState<Set<string>>(new Set());

  // Dialogs
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingToolbox, setEditingToolbox] = useState<Partial<ToolboxItem> | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingToolbox, setViewingToolbox] = useState<ToolboxItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // Fetch user completions
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("toolbox_completions" as any)
      .select("toolbox_id")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        if (data) setUserCompletions(new Set((data as any[]).map(d => d.toolbox_id)));
      });
  }, [session?.user?.id, viewerOpen]);

  const categories = useMemo(() => {
    return ["all", ...new Set(toolboxes.map(t => t.category))].sort();
  }, [toolboxes]);

  const filteredToolboxes = useMemo(() => {
    return toolboxes.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesCategory = activeCategory === "all" || t.category === activeCategory;
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      // Non-admins only see published (RLS handles this, but extra safety)
      if (!canManage && t.status !== "published") return false;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [toolboxes, searchQuery, activeCategory, statusFilter, canManage]);

  const handleDelete = async (id: string) => {
    try {
      await deleteToolbox(id);
      toast.success("Toolbox verwijderd");
      refetch();
    } catch (error: any) {
      toast.error("Fout bij verwijderen: " + error.message);
    } finally {
      setDeleteId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateToolbox(id);
      toast.success("Toolbox gedupliceerd als concept");
      refetch();
    } catch (error: any) {
      toast.error("Fout bij dupliceren: " + error.message);
    }
  };

  const handleStatusChange = async (id: string, status: ToolboxStatus) => {
    try {
      await saveToolbox({ id, status }, true);
      toast.success(`Status gewijzigd naar ${STATUS_CONFIG[status].label}`);
      refetch();
    } catch (error: any) {
      toast.error("Fout: " + error.message);
    }
  };

  const openEditor = (toolbox?: ToolboxItem) => {
    setEditingToolbox(toolbox || null);
    setEditorOpen(true);
  };

  const openViewer = (toolbox: ToolboxItem) => {
    setViewingToolbox(toolbox);
    setViewerOpen(true);
  };

  const getCompletionStatus = (id: string): "completed" | "not_started" => {
    return userCompletions.has(id) ? "completed" : "not_started";
  };

  return (
    <PageLayout
      userEmail={session?.user?.email}
      role={role}
      title="Toolbox Meetingen"
      description="Training en instructies voor operators en medewerkers."
    >
      {canManage && (
        <Button onClick={() => openEditor()} className="shrink-0 gap-2 shadow-lg hover:shadow-primary/20 transition-all">
          <Plus className="h-4 w-4" />
          Nieuwe Toolbox
        </Button>
      )}

      <div className="flex flex-col md:flex-row gap-4 mb-8 justify-between items-start md:items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek toolbox..."
            className="pl-10 bg-background/50 backdrop-blur-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {canManage && (
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-xs px-3">Alle</TabsTrigger>
                <TabsTrigger value="draft" className="text-xs px-3">Concept</TabsTrigger>
                <TabsTrigger value="published" className="text-xs px-3">Gepubliceerd</TabsTrigger>
                <TabsTrigger value="archived" className="text-xs px-3">Archief</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="h-9 flex-wrap">
              <TabsTrigger value="all" className="text-xs px-3">Alle</TabsTrigger>
              {categories.filter(c => c !== "all").map(c => (
                <TabsTrigger key={c} value={c} className="text-xs px-3">{c}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredToolboxes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredToolboxes.map((toolbox) => {
            const status = getCompletionStatus(toolbox.id);
            const statusConfig = STATUS_CONFIG[toolbox.status];

            return (
              <Card key={toolbox.id} className="glass-card overflow-hidden flex flex-col h-full hover:shadow-lg transition-all duration-300 group cursor-pointer" onClick={() => openViewer(toolbox)}>
                <div className="relative h-48 w-full overflow-hidden bg-muted">
                  {(toolbox.cover_image_url || toolbox.thumbnail_url) ? (
                    <img
                      src={toolbox.cover_image_url || toolbox.thumbnail_url || ""}
                      alt={toolbox.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary/5">
                      <BookOpen className="h-12 w-12 text-primary/40" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    {toolbox.is_mandatory && (
                      <Badge className="bg-accent text-accent-foreground shadow-sm border-none">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Verplicht
                      </Badge>
                    )}
                    <Badge className="shadow-sm backdrop-blur-md bg-black/50 hover:bg-black/70 border-none text-white">
                      {toolbox.category}
                    </Badge>
                  </div>
                  {canManage && (
                    <div className="absolute top-3 left-3">
                      <Badge variant={statusConfig.variant} className="gap-1">
                        {statusConfig.icon} {statusConfig.label}
                      </Badge>
                    </div>
                  )}
                  {/* Completion indicator */}
                  {status === "completed" && (
                    <div className="absolute bottom-3 left-3">
                      <Badge className="bg-success text-success-foreground gap-1 border-none">
                        <CheckCircle2 className="h-3 w-3" /> Voltooid
                      </Badge>
                    </div>
                  )}
                </div>

                <CardHeader className="pb-2">
                  <CardTitle className="text-xl line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {toolbox.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-3 text-xs mt-1">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {format(new Date(toolbox.created_at), "d MMM yyyy", { locale: nl })}
                    </span>
                    {toolbox.estimated_duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {toolbox.estimated_duration_minutes} min
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {toolbox.description || "Geen beschrijving beschikbaar."}
                  </p>
                </CardContent>

                <CardFooter className="pt-0 flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    variant={status === "completed" ? "secondary" : "default"}
                    onClick={(e) => { e.stopPropagation(); openViewer(toolbox); }}
                  >
                    <Eye className="h-4 w-4" />
                    {status === "completed" ? "Nogmaals bekijken" : "Openen"}
                  </Button>

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditor(toolbox); }}>
                          <Pencil className="h-4 w-4 mr-2" /> Bewerken
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(toolbox.id); }}>
                          <Copy className="h-4 w-4 mr-2" /> Dupliceren
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {toolbox.status !== "published" && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(toolbox.id, "published"); }}>
                            <Send className="h-4 w-4 mr-2" /> Publiceren
                          </DropdownMenuItem>
                        )}
                        {toolbox.status !== "archived" && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(toolbox.id, "archived"); }}>
                            <Archive className="h-4 w-4 mr-2" /> Archiveren
                          </DropdownMenuItem>
                        )}
                        {toolbox.status !== "draft" && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(toolbox.id, "draft"); }}>
                            <Pencil className="h-4 w-4 mr-2" /> Terug naar concept
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(toolbox.id); }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="bg-muted/30 p-6 rounded-full inline-block mb-4">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Geen toolboxes gevonden</h3>
          <p className="text-muted-foreground">Probeer een andere zoekopdracht of categorie.</p>
        </div>
      )}

      {/* Editor Dialog */}
      <ToolboxEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        toolbox={editingToolbox}
        onSaved={refetch}
        categories={categories.filter(c => c !== "all")}
      />

      {/* Viewer Dialog */}
      <ToolboxViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        toolbox={viewingToolbox}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Toolbox verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze toolbox wilt verwijderen? Alle secties en voortgang worden ook verwijderd. Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default ToolboxPage;
