import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, ExternalLink, FileText, CheckCircle2, XCircle, Image as ImageIcon, Video, ListChecks, HelpCircle } from "lucide-react";
import type { SectionType } from "@/hooks/useToolbox";

interface SectionData {
  id: string;
  section_type: SectionType;
  title: string | null;
  content: string;
  sort_order: number;
}

interface Props {
  section: SectionData;
  index: number;
  interactive?: boolean;
  onChecklistChange?: (sectionId: string, checkedItems: boolean[]) => void;
  onQuizAnswer?: (sectionId: string, answers: number[]) => void;
}

// Simple markdown-like rendering
function renderTextContent(text: string) {
  // Check if content looks like HTML (starts with < and contains closing tag)
  const isHtml = /<[a-z][\s\S]*>/i.test(text);

  if (isHtml) {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-4 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mt-6 [&>h2]:mb-3 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mt-4 [&>h3]:mb-2 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4"
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }

  // Fallback to existing Markdown renderer
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Headers
    if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-semibold mt-4 mb-2">{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
    // List items
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return <li key={i} className="ml-4 list-disc text-foreground">{formatInline(line.slice(2))}</li>;
    }
    // Empty line
    if (line.trim() === "") return <div key={i} className="h-2" />;
    // Normal paragraph
    return <p key={i} className="text-foreground leading-relaxed">{formatInline(line)}</p>;
  });
}

function formatInline(text: string) {
  // Bold
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // Italic
    const italicParts = part.split(/(\*[^*]+\*)/g);
    return italicParts.map((ip, j) => {
      if (ip.startsWith("*") && ip.endsWith("*") && !ip.startsWith("**")) {
        return <em key={`${i}-${j}`}>{ip.slice(1, -1)}</em>;
      }
      return ip;
    });
  });
}

function getVideoEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

export function ToolboxSectionRenderer({ section, index, interactive = false, onChecklistChange, onQuizAnswer }: Props) {
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);

  const renderContent = () => {
    switch (section.section_type) {
      case "text":
        return (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {renderTextContent(section.content)}
          </div>
        );

      case "image":
        return (
          <div className="space-y-2">
            {section.content && (
              <img
                src={section.content}
                alt={section.title || "Afbeelding"}
                className="w-full rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => window.open(section.content, "_blank")}
              />
            )}
          </div>
        );

      case "video": {
        const embedUrl = getVideoEmbedUrl(section.content);
        if (embedUrl) {
          return (
            <div className="aspect-video rounded-lg overflow-hidden border shadow-sm">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          );
        }
        return (
          <Button variant="outline" asChild className="gap-2">
            <a href={section.content} target="_blank" rel="noopener noreferrer">
              <Video className="h-4 w-4" /> Video openen
            </a>
          </Button>
        );
      }

      case "file": {
        const isPdf = section.content?.toLowerCase().endsWith(".pdf");
        return (
          <Button variant="outline" asChild className="gap-2">
            <a href={section.content} target="_blank" rel="noopener noreferrer">
              {isPdf ? <Download className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
              <FileText className="h-4 w-4" />
              {isPdf ? "PDF downloaden" : "Bestand openen"}
            </a>
          </Button>
        );
      }

      case "quiz": {
        let questions: { question: string; options: string[]; correct: number }[] = [];
        try { questions = JSON.parse(section.content); } catch { return null; }

        if (questions.length === 0) return <p className="text-muted-foreground">Geen vragen ingesteld.</p>;

        return (
          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div key={qIdx} className="space-y-2 p-4 bg-muted/30 rounded-lg border">
                <p className="font-medium">
                  <span className="text-primary mr-1.5">V{qIdx + 1}.</span>
                  {q.question}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.filter(o => o.trim()).map((opt, oIdx) => {
                    const isSelected = quizAnswers[qIdx] === oIdx;
                    const isCorrect = quizSubmitted && oIdx === q.correct;
                    const isWrong = quizSubmitted && isSelected && oIdx !== q.correct;

                    return (
                      <Button
                        key={oIdx}
                        variant={isSelected ? "default" : "outline"}
                        className={`justify-start text-left h-auto py-2 px-3 ${isCorrect ? "border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300" :
                          isWrong ? "border-destructive bg-destructive/10 text-destructive" : ""
                          }`}
                        onClick={() => {
                          if (quizSubmitted) return;
                          const newAnswers = [...quizAnswers];
                          newAnswers[qIdx] = oIdx;
                          setQuizAnswers(newAnswers);
                        }}
                        disabled={quizSubmitted}
                      >
                        {quizSubmitted && isCorrect && <CheckCircle2 className="h-4 w-4 mr-1.5 shrink-0" />}
                        {quizSubmitted && isWrong && <XCircle className="h-4 w-4 mr-1.5 shrink-0" />}
                        {opt}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
            {interactive && !quizSubmitted && (
              <Button
                onClick={() => {
                  setQuizSubmitted(true);
                  const score = questions.reduce((acc, q, i) => acc + (quizAnswers[i] === q.correct ? 1 : 0), 0);
                  onQuizAnswer?.(section.id, quizAnswers);
                }}
                disabled={quizAnswers.length < questions.length || quizAnswers.some(a => a === undefined)}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> Antwoorden controleren
              </Button>
            )}
            {quizSubmitted && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  Score: {questions.reduce((acc, q, i) => acc + (quizAnswers[i] === q.correct ? 1 : 0), 0)} / {questions.length}
                </Badge>
              </div>
            )}
          </div>
        );
      }

      case "checklist": {
        let items: { text: string }[] = [];
        try { items = JSON.parse(section.content); } catch { return null; }

        if (items.length === 0) return <p className="text-muted-foreground">Geen items ingesteld.</p>;

        return (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <label key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                <Checkbox
                  checked={checkedItems[idx] || false}
                  onCheckedChange={(checked) => {
                    const newChecked = [...checkedItems];
                    newChecked[idx] = !!checked;
                    setCheckedItems(newChecked);
                    onChecklistChange?.(section.id, newChecked);
                  }}
                  disabled={!interactive}
                  className="mt-0.5"
                />
                <span className={`text-sm ${checkedItems[idx] ? "line-through text-muted-foreground" : ""}`}>
                  {item.text}
                </span>
              </label>
            ))}
            {interactive && items.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {checkedItems.filter(Boolean).length} / {items.length} voltooid
              </p>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  const sectionIcons: Record<SectionType, React.ReactNode> = {
    text: null,
    image: <ImageIcon className="h-4 w-4 text-muted-foreground" />,
    video: <Video className="h-4 w-4 text-muted-foreground" />,
    file: <FileText className="h-4 w-4 text-muted-foreground" />,
    quiz: <HelpCircle className="h-4 w-4 text-muted-foreground" />,
    checklist: <ListChecks className="h-4 w-4 text-muted-foreground" />,
  };

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
      {section.title && (
        <div className="flex items-center gap-2 mb-2">
          {sectionIcons[section.section_type]}
          <h3 className="text-lg font-semibold">{section.title}</h3>
        </div>
      )}
      {renderContent()}
    </div>
  );
}
