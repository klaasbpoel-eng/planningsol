import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Loader2, Save, Send, Eye, Pencil, Clock, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import type { ToolboxItem } from "@/hooks/useToolbox";
import { saveToolbox, saveSections, uploadToolboxFile, useToolboxSections } from "@/hooks/useToolbox";
import { ToolboxSectionEditor, type EditorSection } from "./ToolboxSectionEditor";
import { ToolboxSectionRenderer } from "./ToolboxSectionRenderer";
import { useDebounce } from "@/hooks/use-debounce";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolbox: Partial<ToolboxItem> | null;
  onSaved: () => void;
  categories: string[];
}

const DEFAULT_CATEGORIES = ["Veiligheid", "Training", "Instructie", "Onderhoud", "Algemeen"];

export function ToolboxEditorDialog({ open, onOpenChange, toolbox, onSaved, categories }: Props) {
  const isEditing = !!toolbox?.id;
  const { sections: existingSections, loading: sectionsLoading } = useToolboxSections(toolbox?.id || null);

  const [formData, setFormData] = useState<Partial<ToolboxItem>>({
    title: "",
    description: "",
    category: "Algemeen",
    status: "draft",
    is_mandatory: false,
    estimated_duration_minutes: null,
    thumbnail_url: "",
    cover_image_url: "",
  });

  const [editorSections, setEditorSections] = useState<EditorSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("editor");

  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...categories])].sort();

  // Load initial data
  useEffect(() => {
    if (toolbox) {
      setFormData({
        ...toolbox,
        category: toolbox.category || "Algemeen",
        status: toolbox.status || "draft",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        category: "Algemeen",
        status: "draft",
        is_mandatory: false,
        estimated_duration_minutes: null,
        thumbnail_url: "",
        cover_image_url: "",
      });
      setEditorSections([]);
    }
  }, [toolbox]);

  // Load sections
  useEffect(() => {
    if (existingSections.length > 0) {
      setEditorSections(existingSections.map(s => ({
        id: s.id,
        section_type: s.section_type,
        title: s.title || "",
        content: s.content,
        sort_order: s.sort_order,
      })));
    } else if (!isEditing) {
      setEditorSections([]);
    }
  }, [existingSections, isEditing]);

  const saveToDb = async (publish = false, silent = false) => {
    try {
      if (!formData.title) return; // Don't autosave if no title

      if (!silent) setSaving(true);

      const dataToSave = {
        ...formData,
        status: publish ? "published" as const : "draft" as const,
      };

      const id = await saveToolbox(dataToSave, isEditing);

      // Update local ID if it was a new toolbox
      if (!formData.id) {
        setFormData(prev => ({ ...prev, id }));
      }

      await saveSections(id, editorSections.map((s, i) => ({
        toolbox_id: id,
        section_type: s.section_type,
        title: s.title || null,
        content: s.content,
        sort_order: i,
      })));

      setLastSaved(new Date());

      if (!silent) {
        toast.success(publish ? "Toolbox gepubliceerd!" : isEditing ? "Toolbox bijgewerkt!" : "Toolbox opgeslagen!");
        onSaved();
      }

      if (publish) onOpenChange(false);

    } catch (error: any) {
      console.error("Error saving toolbox:", error);
      if (!silent) toast.error("Fout bij opslaan: " + error.message);
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const debouncedFormData = useDebounce(formData, 30000);
  const debouncedSections = useDebounce(editorSections, 30000);

  // Trigger autosave on changes
  useEffect(() => {
    if (debouncedFormData.title && (debouncedFormData.id || debouncedSections.length > 0)) {
      saveToDb(false, true);
    }
  }, [debouncedFormData, debouncedSections]);

  const handleManualSave = (publish = false) => {
    if (!formData.title) {
      toast.error("Titel is verplicht");
      return;
    }
    saveToDb(publish, false);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadToolboxFile(file, "covers");
      setFormData(prev => ({ ...prev, cover_image_url: url }));
      toast.success("Omslagafbeelding geüpload!");
    } catch (error: any) {
      toast.error("Upload mislukt: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        <DialogHeader className="px-6 py-3 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle className="flex items-center gap-2 text-lg">
              {isEditing ? "Toolbox Bewerken" : "Nieuwe Toolbox"}
              {lastSaved && <span className="text-xs font-normal text-muted-foreground ml-2">Laatst opgeslagen: {lastSaved.toLocaleTimeString()}</span>}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="xl:hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-8">
                <TabsList className="h-8">
                  <TabsTrigger value="editor" className="text-xs px-2 h-7">Editor</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs px-2 h-7">Preview</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Editor Column */}
          <div className={`flex-1 overflow-hidden flex flex-col ${activeTab === 'preview' ? 'hidden xl:flex' : 'flex'}`}>
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8 max-w-4xl mx-auto w-full">

                {/* Cover Image Area */}
                <div className="group relative w-full h-48 md:h-60 bg-muted/40 rounded-xl border-2 border-dashed border-border/50 overflow-hidden transition-all hover:border-primary/50 hover:bg-muted/60">
                  {formData.cover_image_url ? (
                    <>
                      <img src={formData.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => document.getElementById('cover-upload')?.click()}>
                          <ImageIcon className="h-4 w-4 mr-2" /> Wijzigen
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setFormData(prev => ({ ...prev, cover_image_url: "" }))}>
                          Verwijderen
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full cursor-pointer" onClick={() => document.getElementById('cover-upload')?.click()}>
                      <div className="p-4 rounded-full bg-background shadow-sm mb-2 group-hover:scale-105 transition-transform">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-sm">Omslagafbeelding toevoegen</p>
                      <p className="text-xs text-muted-foreground">Klik om te uploaden</p>
                    </div>
                  )}
                  <input
                    id="cover-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleCoverUpload}
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-base">Titel</Label>
                      <Input
                        id="title"
                        value={formData.title || ""}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Bijv. Veilig werken op hoogte"
                        className="text-lg font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categorie</Label>
                      <Select value={formData.category || "Algemeen"} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allCategories.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Beschrijving</Label>
                      <Textarea
                        value={formData.description || ""}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Waar gaat deze toolbox over?"
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-2">
                        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" /> Duur (min)
                        </Label>
                        <Input
                          type="number"
                          value={formData.estimated_duration_minutes ?? ""}
                          onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="15"
                          min={1}
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <div className="flex items-center h-10 px-3 border rounded-md bg-muted/20">
                          <Switch
                            checked={formData.is_mandatory || false}
                            onCheckedChange={(v) => setFormData({ ...formData, is_mandatory: v })}
                            className="mr-2"
                          />
                          <span className="text-sm">{formData.is_mandatory ? "Verplicht" : "Optioneel"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      Inhoud
                      <Badge variant="outline" className="ml-2 font-normal">
                        {editorSections.length} secties
                      </Badge>
                    </h3>
                  </div>
                  <ToolboxSectionEditor sections={editorSections} onChange={setEditorSections} />
                </div>

              </div>
            </ScrollArea>
          </div>

          {/* Preview Column (Hidden on mobile unless tab selected, always distinct on XL) */}
          <div className={`flex-1 border-l bg-muted/10 overflow-hidden flex-col ${activeTab === 'editor' ? 'hidden xl:flex' : 'flex'}`}>
            <div className="p-3 border-b bg-background/50 backdrop-blur text-center text-sm font-medium text-muted-foreground shrink-0">
              Live Preview
            </div>
            <ScrollArea className="flex-1">
              <div className="p-6 md:p-10 max-w-2xl mx-auto">
                <div className="bg-card shadow-lg rounded-xl overflow-hidden border min-h-[500px]">
                  {/* Preview Content */}
                  <div>
                    {(formData.cover_image_url || formData.thumbnail_url) && (
                      <div className="relative h-48 w-full overflow-hidden">
                        <img
                          src={formData.cover_image_url || formData.thumbnail_url || ""}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-4 left-6 right-6">
                          <Badge className="bg-primary hover:bg-primary mb-2 border-none text-white">
                            {formData.category || "Algemeen"}
                          </Badge>
                          <h1 className="text-2xl font-bold text-white leading-tight">{formData.title || "Naamloze Toolbox"}</h1>
                        </div>
                      </div>
                    )}
                    {!formData.cover_image_url && !formData.thumbnail_url && (
                      <div className="bg-primary/5 p-6 border-b">
                        <Badge className="bg-primary hover:bg-primary mb-3 text-white">
                          {formData.category || "Algemeen"}
                        </Badge>
                        <h1 className="text-2xl font-bold text-foreground">{formData.title || "Naamloze Toolbox"}</h1>
                      </div>
                    )}

                    <div className="p-6 space-y-6">
                      {formData.description && (
                        <div className="text-muted-foreground leading-relaxed">
                          {formData.description}
                        </div>
                      )}

                      {editorSections.map((section, idx) => (
                        <ToolboxSectionRenderer key={section.id} section={section as any} index={idx} />
                      ))}

                      {editorSections.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/30">
                          <p className="text-sm">Nog geen inhoud.</p>
                          <p className="text-xs mt-1">Voeg secties toe in de editor.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-background shrink-0 gap-2">
          <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
            {formData.status === 'published' && <Badge className="bg-green-500 hover:bg-green-600">Gepubliceerd</Badge>}
            {formData.status === 'draft' && <Badge variant="secondary">Concept</Badge>}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Sluiten</Button>
          <Button variant="secondary" onClick={() => handleManualSave(false)} disabled={saving || !formData.title} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Opslaan als concept
          </Button>
          <Button onClick={() => handleManualSave(true)} disabled={saving || !formData.title} className="gap-1.5 min-w-[120px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publiceren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
