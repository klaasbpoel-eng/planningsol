import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, BookOpen, FileText, Download, ExternalLink, Plus, Pencil, Trash2, Eye, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLayout } from "@/components/layout/PageLayout";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { toast } from "sonner";

interface ToolboxItem {
    id: string;
    title: string;
    description: string | null;
    file_url: string | null;
    thumbnail_url: string | null;
    category: string;
    created_at: string;
}

const ToolboxPage = () => {
    const [session, setSession] = useState<any>(null);
    const { isAdmin, role } = useUserPermissions(session?.user?.id);
    const canManage = isAdmin || role === 'supervisor';

    const [toolboxes, setToolboxes] = useState<ToolboxItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");

    // Management State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<ToolboxItem>>({
        title: "",
        description: "",
        category: "General",
        thumbnail_url: "",
        file_url: ""
    });
    const [uploading, setUploading] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        fetchToolboxes();

        return () => subscription.unsubscribe();
    }, []);

    const fetchToolboxes = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("toolboxes" as any)
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setToolboxes((data as any) || []);
        } catch (error) {
            console.error("Error fetching toolboxes:", error);
            toast.error("Fout bij het laden van toolboxes");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            if (!formData.title) {
                toast.error("Titel is verplicht");
                return;
            }

            const payload = {
                title: formData.title,
                description: formData.description,
                category: formData.category || "General",
                thumbnail_url: formData.thumbnail_url,
                file_url: formData.file_url,
                updated_at: new Date().toISOString()
            };

            if (isEditing && formData.id) {
                const { error } = await supabase
                    .from("toolboxes" as any)
                    .update(payload)
                    .eq("id", formData.id);
                if (error) throw error;
                toast.success("Toolbox bijgewerkt");
            } else {
                const { error } = await supabase
                    .from("toolboxes" as any)
                    .insert([payload]);
                if (error) throw error;
                toast.success("Toolbox aangemaakt");
            }

            setIsDialogOpen(false);
            fetchToolboxes();
            resetForm();
        } catch (error: any) {
            console.error("Error saving toolbox:", error);
            toast.error("Fout bij opslaan: " + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from("toolboxes" as any)
                .delete()
                .eq("id", id);

            if (error) throw error;
            toast.success("Toolbox verwijderd");
            fetchToolboxes();
        } catch (error: any) {
            console.error("Error deleting toolbox:", error);
            toast.error("Fout bij verwijderen: " + error.message);
        } finally {
            setDeleteId(null);
        }
    };

    const openCreateDialog = () => {
        resetForm();
        setIsEditing(false);
        setIsDialogOpen(true);
    };

    const openEditDialog = (item: ToolboxItem) => {
        setFormData({ ...item });
        setIsEditing(true);
        setIsDialogOpen(true);
    };

    const resetForm = () => {
        setFormData({
            title: "",
            description: "",
            category: "General",
            thumbnail_url: "",
            file_url: ""
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'thumbnail_url' | 'file_url') => {
        try {
            setUploading(true);
            if (!e.target.files || e.target.files.length === 0) {
                return;
            }
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('toolbox-files')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('toolbox-files')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, [field]: publicUrl }));
            toast.success("Bestand geüpload!");
        } catch (error: any) {
            console.error("Error uploading file:", error);
            toast.error("Upload mislukt: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const categories = ["all", ...new Set(toolboxes.map(t => t.category))].sort();

    const filteredToolboxes = toolboxes.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
        const matchesCategory = activeCategory === "all" || t.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const ToolboxCard = ({ item, preview = false }: { item: Partial<ToolboxItem>, preview?: boolean }) => (
        <Card className={`glass-card overflow-hidden flex flex-col h-full ${preview ? 'scale-95 shadow-xl border-primary/20 ring-1 ring-primary/10' : 'hover:shadow-lg transition-all duration-300 group'}`}>
            <div className="relative h-48 w-full overflow-hidden bg-muted group-hover:scale-[1.02] transition-transform duration-500">
                {item.thumbnail_url ? (
                    <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500"
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary/5">
                        <BookOpen className="h-12 w-12 text-primary/40" />
                    </div>
                )}
                {item.category && (
                    <Badge className="absolute top-3 right-3 shadow-sm backdrop-blur-md bg-black/50 hover:bg-black/70 border-none text-white">
                        {item.category}
                    </Badge>
                )}
            </div>

            <CardHeader className="pb-2">
                <CardTitle className={`text-xl line-clamp-2 leading-tight ${!preview && 'group-hover:text-primary'} transition-colors`}>
                    {item.title || "Titel van toolbox..."}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 text-xs mt-1">
                    <FileText className="h-3 w-3" />
                    {item.created_at ? format(new Date(item.created_at), "d MMMM yyyy", { locale: nl }) : "Datum"}
                </CardDescription>
            </CardHeader>

            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">
                    {item.description || "Geen beschrijving beschikbaar."}
                </p>
            </CardContent>

            <CardFooter className="pt-0 flex gap-2">
                <Button className="flex-1 gap-2" variant="default" asChild>
                    <a href={item.file_url || "#"} target="_blank" rel="noopener noreferrer" className={!item.file_url ? "pointer-events-none opacity-50" : ""}>
                        {item.file_url?.toLowerCase().endsWith(".pdf") ? (
                            <Download className="h-4 w-4" />
                        ) : (
                            <ExternalLink className="h-4 w-4" />
                        )}
                        Openen
                    </a>
                </Button>

                {!preview && canManage && item.id && (
                    <div className="flex gap-1 ml-auto">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary" onClick={() => openEditDialog(item as ToolboxItem)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(item.id as string)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </CardFooter>
        </Card>
    );

    return (
        <PageLayout
            userEmail={session?.user?.email}
            role={role}
            title="Toolbox Meetingen"
            description="Training en instructies voor operators en medewerkers."
        >
                    {canManage && (
                            <Button onClick={openCreateDialog} className="shrink-0 gap-2 shadow-lg hover:shadow-primary/20 transition-all">
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

                        <Tabs defaultValue="all" value={activeCategory} onValueChange={setActiveCategory} className="w-full md:w-auto">
                            <TabsList className="grid w-full grid-cols-2 md:inline-flex md:w-auto h-auto p-1 bg-muted/50">
                                <TabsTrigger value="all" className="px-4 py-2 text-sm">Alle</TabsTrigger>
                                {categories.filter(c => c !== "all").map(c => (
                                    <TabsTrigger key={c} value={c} className="px-4 py-2 text-sm">{c}</TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
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
                            {filteredToolboxes.map((toolbox) => (
                                <ToolboxCard key={toolbox.id} item={toolbox} />
                            ))}
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

                {/* Management Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                        <DialogHeader className="px-6 py-4 border-b bg-muted/10">
                            <DialogTitle>{isEditing ? "Toolbox Bewerken" : "Nieuwe Toolbox"}</DialogTitle>
                            <DialogDescription>
                                {isEditing ? "Pas de toolbox details aan en sla op." : "Vul de details in voor de nieuwe toolbox."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                                {/* Left Column: Form */}
                                <div className="space-y-4 h-full overflow-y-auto pr-2">
                                    <div className="flex items-center gap-2 mb-4 text-primary font-medium">
                                        <Pencil className="h-4 w-4" /> Editor
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="title">Titel *</Label>
                                        <Input
                                            id="title"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            placeholder="Bijv. Veiligheidscilinders instructie"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="category">Categorie</Label>
                                        <Input
                                            id="category"
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            placeholder="Bijv. Training, Veiligheid, Instructie"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="image">Thumbnail</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="image"
                                                value={formData.thumbnail_url || ""}
                                                onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                                                placeholder="https://..."
                                                className="flex-1"
                                            />
                                            <div className="relative">
                                                <Input
                                                    type="file"
                                                    id="thumbnail-upload"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => handleFileUpload(e, 'thumbnail_url')}
                                                    disabled={uploading}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    disabled={uploading}
                                                    onClick={() => document.getElementById('thumbnail-upload')?.click()}
                                                >
                                                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Upload een afbeelding of plak een URL.</p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="file">Bestand / Link</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="file"
                                                value={formData.file_url || ""}
                                                onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                                                placeholder="https://... (PDF, Video link, etc.)"
                                                className="flex-1"
                                            />
                                            <div className="relative">
                                                <Input
                                                    type="file"
                                                    id="file-upload"
                                                    className="hidden"
                                                    onChange={(e) => handleFileUpload(e, 'file_url')}
                                                    disabled={uploading}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    disabled={uploading}
                                                    onClick={() => document.getElementById('file-upload')?.click()}
                                                >
                                                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Upload een PDF/Video of plak een directe link.</p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="description">Beschrijving</Label>
                                        <Textarea
                                            id="description"
                                            value={formData.description || ""}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Korte beschrijving van de inhoud..."
                                            rows={5}
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Preview */}
                                <div className="space-y-4 bg-muted/30 rounded-xl p-6 border border-border/50 flex flex-col">
                                    <div className="flex items-center gap-2 mb-4 text-primary font-medium">
                                        <Eye className="h-4 w-4" /> Live Preview
                                    </div>

                                    <div className="flex-1 flex items-center justify-center p-4 min-h-[400px]">
                                        <div className="w-full max-w-sm transform transition-all duration-300">
                                            <ToolboxCard
                                                item={{
                                                    ...formData,
                                                    created_at: formData.created_at || new Date().toISOString()
                                                }}
                                                preview={true}
                                            />
                                        </div>
                                    </div>

                                    <div className="text-center text-xs text-muted-foreground">
                                        Dit is hoe de kaart eruit zal zien voor gebruikers.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="px-6 py-4 border-t bg-muted/10">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuleren</Button>
                            <Button onClick={handleSave} disabled={!formData.title}>
                                {isEditing ? "Wijzigingen Opslaan" : "Aanmaken"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Toolbox verwijderen</AlertDialogTitle>
                            <AlertDialogDescription>
                                Weet je zeker dat je deze toolbox wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
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
