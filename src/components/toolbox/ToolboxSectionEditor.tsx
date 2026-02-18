import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GripVertical, Trash2, Type, Image, Video, FileText,
  HelpCircle, ListChecks, Upload, Loader2, Plus, ChevronUp, ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SectionType } from "@/hooks/useToolbox";
import { uploadToolboxFile } from "@/hooks/useToolbox";
import { RichTextEditor } from "./RichTextEditor";

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

function getEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

interface Props {
  sections: EditorSection[];
  onChange: (sections: EditorSection[]) => void;
}

interface SortableSectionProps {
  section: EditorSection;
  updateSection: (id: string, updates: Partial<EditorSection>) => void;
  removeSection: (id: string) => void;
  renderSectionEditor: (section: EditorSection) => React.ReactNode;
}

function SortableSection({ section, updateSection, removeSection, renderSectionEditor }: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative" as const,
  };

  const getBorderColor = (type: SectionType) => {
    switch (type) {
      case "text": return "border-l-blue-500";
      case "image": return "border-l-green-500";
      case "video": return "border-l-purple-500";
      case "file": return "border-l-orange-500";
      case "quiz": return "border-l-yellow-500";
      case "checklist": return "border-l-teal-500";
      default: return "border-l-border";
    }
  };

  const [expanded, setExpanded] = useState(true);

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className={`border-border/60 border-l-4 ${getBorderColor(section.section_type)}`}>
        <CardHeader className="pb-3 flex flex-row items-center gap-2 space-y-0 py-3 px-4">
          <div {...listeners} className="cursor-grab touch-none p-1 -ml-1 hover:bg-muted/50 rounded">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
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
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeSection(section.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        {expanded && (
          <CardContent className="pt-0 px-4 pb-4">
            {renderSectionEditor(section)}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export function ToolboxSectionEditor({ sections, onChange }: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);

      onChange(arrayMove(sections, oldIndex, newIndex).map((s, i) => ({ ...s, sort_order: i })));
    }

    setActiveDragId(null);
  };

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
            <RichTextEditor
              content={section.content}
              onChange={(content) => updateSection(section.id, { content })}
            />
          </div>
        );

      case "image":
        return (
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <div
                className="border-2 border-dashed border-border/50 rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => document.getElementById(`file-${section.id}`)?.click()}
              >
                <div className="p-3 bg-muted/50 rounded-full">
                  <Image className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Klik om te uploaden of sleep een afbeelding</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP — max 5 MB</p>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground whitespace-nowrap">of via URL:</span>
                <Input
                  value={section.content}
                  onChange={(e) => updateSection(section.id, { content: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 h-8 text-sm"
                />
              </div>

              <input
                id={`file-${section.id}`}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(section.id, file);
                }}
              />
            </div>

            {section.content && (
              <div className="relative group">
                <img src={section.content} alt="Preview" className="max-h-64 rounded-lg border object-cover w-full bg-muted/20" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => updateSection(section.id, { content: "" })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        );

      case "video":
        const embedUrl = getEmbedUrl(section.content);
        return (
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <Video className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={section.content}
                onChange={(e) => updateSection(section.id, { content: e.target.value })}
                placeholder="YouTube of Vimeo URL plakken..."
              />
            </div>

            {embedUrl && (
              <div className="aspect-video rounded-lg overflow-hidden border bg-black shadow-sm max-w-md">
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            {!embedUrl && section.content && (
              <p className="text-xs text-destructive">Geen geldige video URL herkend.</p>
            )}
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {sections.map((section) => (
              <SortableSection
                key={section.id}
                section={section}
                updateSection={updateSection}
                removeSection={removeSection}
                renderSectionEditor={renderSectionEditor}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) }}>
          {activeDragId ? (
            <div className="opacity-80">
              <Card className="border-border/60 border-l-4 border-l-primary">
                <CardHeader className="pb-3 flex flex-row items-center gap-2 space-y-0 py-3 px-4">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary" className="gap-1.5">{getSectionLabel(sections.find(s => s.id === activeDragId)!.section_type)}</Badge>
                  <span className="text-sm font-medium">{sections.find(s => s.id === activeDragId)?.title || "Naamloos"}</span>
                </CardHeader>
              </Card>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
