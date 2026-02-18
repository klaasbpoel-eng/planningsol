import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GripVertical, Trash2, Type, Image, Video, FileText,
  HelpCircle, ListChecks, Upload, Loader2, Plus, ChevronUp, ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import type { SectionType } from "@/hooks/useToolbox";
import { uploadToolboxFile } from "@/hooks/useToolbox";

export interface EditorSection {
  id: string;
  section_type: SectionType;
  title: string;
  content: string;
  sort_order: number;
}

const SECTION_TYPES: { type: SectionType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: "text", label: "Tekst", icon: <Type className="h-4 w-4" />, description: "Rijke tekst met opmaak" },
  { type: "image", label: "Afbeelding", icon: <Image className="h-4 w-4" />, description: "Upload of URL" },
  { type: "video", label: "Video", icon: <Video className="h-4 w-4" />, description: "YouTube/Vimeo embed" },
  { type: "file", label: "Bestand", icon: <FileText className="h-4 w-4" />, description: "PDF of document" },
  { type: "quiz", label: "Quiz", icon: <HelpCircle className="h-4 w-4" />, description: "Meerkeuzevragen" },
  { type: "checklist", label: "Checklist", icon: <ListChecks className="h-4 w-4" />, description: "Afvinkbare stappen" },
];

function getSectionIcon(type: SectionType) {
  return SECTION_TYPES.find(t => t.type === type)?.icon || <Type className="h-4 w-4" />;
}

function getSectionLabel(type: SectionType) {
  return SECTION_TYPES.find(t => t.type === type)?.label || type;
}

interface Props {
  sections: EditorSection[];
  onChange: (sections: EditorSection[]) => void;
}

export function ToolboxSectionEditor({ sections, onChange }: Props) {
  const [uploading, setUploading] = useState<string | null>(null);

  const addSection = (type: SectionType) => {
    const newSection: EditorSection = {
      id: crypto.randomUUID(),
      section_type: type,
      title: "",
      content: type === "quiz" ? JSON.stringify([{ question: "", options: ["", "", "", ""], correct: 0 }]) :
               type === "checklist" ? JSON.stringify([{ text: "", checked: false }]) : "",
      sort_order: sections.length,
    };
    onChange([...sections, newSection]);
  };

  const updateSection = (id: string, updates: Partial<EditorSection>) => {
    onChange(sections.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSection = (id: string) => {
    onChange(sections.filter(s => s.id !== id).map((s, i) => ({ ...s, sort_order: i })));
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const newSections = [...sections];
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    onChange(newSections.map((s, i) => ({ ...s, sort_order: i })));
  };

  const handleFileUpload = async (sectionId: string, file: File) => {
    try {
      setUploading(sectionId);
      const url = await uploadToolboxFile(file, "sections");
      updateSection(sectionId, { content: url });
      toast.success("Bestand geüpload!");
    } catch (error: any) {
      toast.error("Upload mislukt: " + error.message);
    } finally {
      setUploading(null);
    }
  };

  const renderSectionEditor = (section: EditorSection) => {
    switch (section.section_type) {
      case "text":
        return (
          <div className="space-y-2">
            <Textarea
              value={section.content}
              onChange={(e) => updateSection(section.id, { content: e.target.value })}
              placeholder="Schrijf hier de tekst voor deze sectie... Gebruik Markdown voor opmaak."
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Ondersteunt Markdown: **vet**, *cursief*, - lijsten, ## koppen</p>
          </div>
        );

      case "image":
        return (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={section.content}
                onChange={(e) => updateSection(section.id, { content: e.target.value })}
                placeholder="Afbeelding URL..."
                className="flex-1"
              />
              <label>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(section.id, file);
                  }}
                />
                <Button type="button" variant="outline" size="icon" asChild disabled={uploading === section.id}>
                  <span>{uploading === section.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>
                </Button>
              </label>
            </div>
            {section.content && (
              <img src={section.content} alt="Preview" className="max-h-40 rounded-md border object-cover" />
            )}
          </div>
        );

      case "video":
        return (
          <div className="space-y-2">
            <Input
              value={section.content}
              onChange={(e) => updateSection(section.id, { content: e.target.value })}
              placeholder="YouTube of Vimeo URL plakken..."
            />
            <p className="text-xs text-muted-foreground">Bijv. https://www.youtube.com/watch?v=...</p>
          </div>
        );

      case "file":
        return (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={section.content}
                onChange={(e) => updateSection(section.id, { content: e.target.value })}
                placeholder="Bestand URL..."
                className="flex-1"
              />
              <label>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(section.id, file);
                  }}
                />
                <Button type="button" variant="outline" size="icon" asChild disabled={uploading === section.id}>
                  <span>{uploading === section.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>
                </Button>
              </label>
            </div>
          </div>
        );

      case "quiz":
        return <QuizEditor section={section} onChange={(content) => updateSection(section.id, { content })} />;

      case "checklist":
        return <ChecklistEditor section={section} onChange={(content) => updateSection(section.id, { content })} />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing sections */}
      {sections.map((section, index) => (
        <Card key={section.id} className="border-border/60">
          <CardHeader className="pb-3 flex flex-row items-center gap-2 space-y-0 py-3 px-4">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
            <Badge variant="secondary" className="gap-1.5 shrink-0">
              {getSectionIcon(section.section_type)}
              {getSectionLabel(section.section_type)}
            </Badge>
            <Input
              value={section.title || ""}
              onChange={(e) => updateSection(section.id, { title: e.target.value })}
              placeholder="Sectietitel (optioneel)..."
              className="flex-1 h-8 text-sm border-none shadow-none focus-visible:ring-0 px-2 bg-transparent"
            />
            <div className="flex gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSection(index, -1)} disabled={index === 0}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeSection(section.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            {renderSectionEditor(section)}
          </CardContent>
        </Card>
      ))}

      {/* Add section buttons */}
      <div className="border-2 border-dashed border-border/50 rounded-lg p-4">
        <p className="text-sm font-medium text-muted-foreground mb-3 text-center">Sectie toevoegen</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {SECTION_TYPES.map(({ type, label, icon }) => (
            <Button
              key={type}
              variant="outline"
              className="flex-col gap-1.5 h-auto py-3 text-xs"
              onClick={() => addSection(type)}
            >
              {icon}
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Quiz sub-editor
function QuizEditor({ section, onChange }: { section: EditorSection; onChange: (content: string) => void }) {
  let questions: { question: string; options: string[]; correct: number }[] = [];
  try { questions = JSON.parse(section.content); } catch { questions = []; }

  const update = (newQ: typeof questions) => onChange(JSON.stringify(newQ));

  const addQuestion = () => {
    update([...questions, { question: "", options: ["", "", "", ""], correct: 0 }]);
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const newQ = [...questions];
    (newQ[idx] as any)[field] = value;
    update(newQ);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const newQ = [...questions];
    newQ[qIdx].options[oIdx] = value;
    update(newQ);
  };

  const removeQuestion = (idx: number) => {
    update(questions.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {questions.map((q, qIdx) => (
        <div key={qIdx} className="space-y-2 p-3 bg-muted/30 rounded-md border">
          <div className="flex gap-2 items-start">
            <span className="text-sm font-medium text-muted-foreground mt-2 shrink-0">V{qIdx + 1}</span>
            <Input
              value={q.question}
              onChange={(e) => updateQuestion(qIdx, "question", e.target.value)}
              placeholder="Vraag..."
              className="flex-1"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeQuestion(qIdx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 pl-7">
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex gap-1.5 items-center">
                <input
                  type="radio"
                  name={`q-${qIdx}`}
                  checked={q.correct === oIdx}
                  onChange={() => updateQuestion(qIdx, "correct", oIdx)}
                  className="accent-primary"
                />
                <Input
                  value={opt}
                  onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                  placeholder={`Optie ${oIdx + 1}`}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5" onClick={addQuestion}>
        <Plus className="h-3.5 w-3.5" /> Vraag toevoegen
      </Button>
    </div>
  );
}

// Checklist sub-editor
function ChecklistEditor({ section, onChange }: { section: EditorSection; onChange: (content: string) => void }) {
  let items: { text: string }[] = [];
  try { items = JSON.parse(section.content); } catch { items = []; }

  const update = (newItems: typeof items) => onChange(JSON.stringify(newItems));

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={item.text}
            onChange={(e) => {
              const newItems = [...items];
              newItems[idx] = { text: e.target.value };
              update(newItems);
            }}
            placeholder={`Stap ${idx + 1}...`}
            className="flex-1 h-8 text-sm"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => update(items.filter((_, i) => i !== idx))}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => update([...items, { text: "" }])}>
        <Plus className="h-3.5 w-3.5" /> Stap toevoegen
      </Button>
    </div>
  );
}
