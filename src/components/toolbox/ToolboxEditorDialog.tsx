import { useState, useEffect } from "react";
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
import { Upload, Loader2, Save, Send, Copy, Eye, Pencil, Clock } from "lucide-react";
import { toast } from "sonner";
import type { ToolboxItem, ToolboxSection } from "@/hooks/useToolbox";
import { saveToolbox, saveSections, uploadToolboxFile, useToolboxSections } from "@/hooks/useToolbox";
import { ToolboxSectionEditor, type EditorSection } from "./ToolboxSectionEditor";
import { ToolboxSectionRenderer } from "./ToolboxSectionRenderer";

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
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("editor");

  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...categories])].sort();

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

  const handleSave = async (publish = false) => {
    try {
      if (!formData.title) {
        toast.error("Titel is verplicht");
        return;
      }
      setSaving(true);

      const dataToSave = {
        ...formData,
        status: publish ? "published" as const : formData.status,
      };

      const id = await saveToolbox(dataToSave, isEditing);
      await saveSections(id, editorSections.map((s, i) => ({
        toolbox_id: id,
        section_type: s.section_type,
        title: s.title || null,
        content: s.content,
        sort_order: i,
      })));

      toast.success(publish ? "Toolbox gepubliceerd!" : isEditing ? "Toolbox bijgewerkt!" : "Toolbox opgeslagen als concept!");
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving toolbox:", error);
      toast.error("Fout bij opslaan: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "thumbnail_url" | "cover_image_url") => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadToolboxFile(file, "covers");
      setFormData(prev => ({ ...prev, [field]: url }));
      toast.success("Afbeelding geüpload!");
    } catch (error: any) {
      toast.error("Upload mislukt: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/10 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Pencil className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {isEditing ? "Toolbox Bewerken" : "Nieuwe Toolbox"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Pas de toolbox aan en sla op." : "Maak een nieuwe toolbox training aan."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-2 border-b shrink-0">
            <TabsList className="h-9">
              <TabsTrigger value="editor" className="gap-1.5 text-sm">
                <Pencil className="h-3.5 w-3.5" /> Editor
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5 text-sm">
                <Eye className="h-3.5 w-3.5" /> Preview
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="editor" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {/* Meta fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Titel *</Label>
                    <Input
                      id="title"
                      value={formData.title || ""}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Bijv. Veiligheidsinstructie gasflessen"
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

                <div className="space-y-2">
                  <Label>Beschrijving</Label>
                  <Textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Korte samenvatting van de toolbox..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Omslagafbeelding</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.cover_image_url || ""}
                        onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                        placeholder="URL..."
                        className="flex-1"
                      />
                      <label>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, "cover_image_url")} />
                        <Button type="button" variant="outline" size="icon" asChild disabled={uploading}>
                          <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>
                        </Button>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Geschatte duur (min)
                    </Label>
                    <Input
                      type="number"
                      value={formData.estimated_duration_minutes ?? ""}
                      onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="bijv. 15"
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Verplicht</Label>
                    <div className="flex items-center gap-2 pt-1.5">
                      <Switch
                        checked={formData.is_mandatory || false}
                        onCheckedChange={(v) => setFormData({ ...formData, is_mandatory: v })}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.is_mandatory ? "Ja, verplicht" : "Nee, optioneel"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section editor */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Inhoud secties</h3>
                  <ToolboxSectionEditor sections={editorSections} onChange={setEditorSections} />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="p-6 max-w-3xl mx-auto">
                {/* Preview header */}
                <div className="mb-6">
                  {(formData.cover_image_url || formData.thumbnail_url) && (
                    <div className="relative h-48 md:h-64 w-full rounded-lg overflow-hidden mb-4">
                      <img
                        src={formData.cover_image_url || formData.thumbnail_url || ""}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <h1 className="text-2xl font-bold text-white">{formData.title || "Toolbox titel"}</h1>
                      </div>
                    </div>
                  )}
                  {!formData.cover_image_url && !formData.thumbnail_url && (
                    <h1 className="text-2xl font-bold mb-2">{formData.title || "Toolbox titel"}</h1>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {formData.category && <Badge variant="secondary">{formData.category}</Badge>}
                    {formData.is_mandatory && <Badge className="bg-accent text-accent-foreground">Verplicht</Badge>}
                    {formData.estimated_duration_minutes && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" /> {formData.estimated_duration_minutes} min
                      </Badge>
                    )}
                  </div>
                  {formData.description && (
                    <p className="text-muted-foreground mt-3">{formData.description}</p>
                  )}
                </div>

                {/* Preview sections */}
                <div className="space-y-6">
                  {editorSections.map((section, idx) => (
                    <ToolboxSectionRenderer key={section.id} section={section as any} index={idx} />
                  ))}
                </div>

                {editorSections.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Voeg secties toe in de Editor tab om de preview te zien.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t bg-muted/10 shrink-0 gap-2">
          <div className="flex items-center gap-2 mr-auto">
            {formData.status && (
              <Badge variant={formData.status === "published" ? "default" : formData.status === "draft" ? "secondary" : "outline"}>
                {formData.status === "draft" ? "Concept" : formData.status === "published" ? "Gepubliceerd" : "Gearchiveerd"}
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuleren</Button>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving || !formData.title} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Opslaan als concept
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving || !formData.title} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publiceren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
