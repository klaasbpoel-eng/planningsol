import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, ArrowLeft, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ToolboxItem } from "@/hooks/useToolbox";
import { useToolboxSections, useToolboxCompletions } from "@/hooks/useToolbox";
import { ToolboxSectionRenderer } from "./ToolboxSectionRenderer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolbox: ToolboxItem | null;
}

export function ToolboxViewer({ open, onOpenChange, toolbox }: Props) {
  const { sections, loading } = useToolboxSections(toolbox?.id || null);
  const [session, setSession] = useState<any>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [quizScores, setQuizScores] = useState<Record<string, number[]>>({});
  const [checklistProgress, setChecklistProgress] = useState<Record<string, boolean[]>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  // Check completion status
  useEffect(() => {
    if (!toolbox?.id || !session?.user?.id) return;
    supabase
      .from("toolbox_completions" as any)
      .select("*")
      .eq("toolbox_id", toolbox.id)
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsCompleted(!!data);
      });
  }, [toolbox?.id, session?.user?.id, open]);

  const handleMarkComplete = async () => {
    if (!toolbox?.id || !session?.user?.id) return;

    // Calculate quiz score if any
    let totalScore: number | null = null;
    const quizSections = sections.filter(s => s.section_type === "quiz");
    if (quizSections.length > 0) {
      let correct = 0;
      let total = 0;
      quizSections.forEach(qs => {
        try {
          const questions = JSON.parse(qs.content);
          const answers = quizScores[qs.id];
          if (answers) {
            questions.forEach((q: any, i: number) => {
              total++;
              if (answers[i] === q.correct) correct++;
            });
          } else {
            total += questions.length;
          }
        } catch {}
      });
      totalScore = total > 0 ? Math.round((correct / total) * 100) : null;
    }

    try {
      const { error } = await supabase
        .from("toolbox_completions" as any)
        .upsert({
          toolbox_id: toolbox.id,
          user_id: session.user.id,
          completed_at: new Date().toISOString(),
          score: totalScore,
        }, { onConflict: "toolbox_id,user_id" });

      if (error) throw error;
      setIsCompleted(true);
      toast.success("Toolbox als voltooid gemarkeerd! 🎉");
    } catch (error: any) {
      toast.error("Fout: " + error.message);
    }
  };

  // Calculate progress based on scroll + checklists
  const totalSections = sections.length;
  const checklistSections = sections.filter(s => s.section_type === "checklist");
  let checklistTotal = 0;
  let checklistDone = 0;
  checklistSections.forEach(cs => {
    try {
      const items = JSON.parse(cs.content);
      checklistTotal += items.length;
      const checked = checklistProgress[cs.id] || [];
      checklistDone += checked.filter(Boolean).length;
    } catch {}
  });

  const progress = checklistTotal > 0
    ? Math.round((checklistDone / checklistTotal) * 100)
    : 0;

  if (!toolbox) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header with cover image */}
        <div className="relative shrink-0">
          {(toolbox.cover_image_url || toolbox.thumbnail_url) ? (
            <div className="h-48 md:h-56 w-full overflow-hidden">
              <img
                src={toolbox.cover_image_url || toolbox.thumbnail_url || ""}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            </div>
          ) : (
            <div className="h-24 bg-primary/10" />
          )}

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">{toolbox.title}</DialogTitle>
              <DialogDescription className="sr-only">Toolbox leesweergave</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">{toolbox.category}</Badge>
              {toolbox.is_mandatory && <Badge className="bg-accent text-accent-foreground">Verplicht</Badge>}
              {toolbox.estimated_duration_minutes && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" /> {toolbox.estimated_duration_minutes} min
                </Badge>
              )}
              {isCompleted && (
                <Badge className="bg-success text-success-foreground gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Voltooid
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {checklistTotal > 0 && (
          <div className="px-6 py-2 border-b shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground shrink-0">Voortgang</span>
              <Progress value={progress} className="flex-1 h-2" />
              <span className="text-xs font-medium shrink-0">{progress}%</span>
            </div>
          </div>
        )}

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-3xl mx-auto space-y-8">
            {toolbox.description && (
              <p className="text-muted-foreground text-lg leading-relaxed">{toolbox.description}</p>
            )}

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : sections.length > 0 ? (
              sections.map((section, idx) => (
                <ToolboxSectionRenderer
                  key={section.id}
                  section={section}
                  index={idx}
                  interactive
                  onChecklistChange={(sectionId, checked) => {
                    setChecklistProgress(prev => ({ ...prev, [sectionId]: checked }));
                  }}
                  onQuizAnswer={(sectionId, answers) => {
                    setQuizScores(prev => ({ ...prev, [sectionId]: answers }));
                  }}
                />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>Deze toolbox heeft nog geen inhoud.</p>
              </div>
            )}

            {/* Complete button */}
            {sections.length > 0 && !isCompleted && (
              <div className="border-t pt-6 mt-8">
                <Button size="lg" className="w-full gap-2" onClick={handleMarkComplete}>
                  <CheckCircle2 className="h-5 w-5" />
                  Markeer als voltooid
                </Button>
              </div>
            )}

            {isCompleted && (
              <div className="border-t pt-6 mt-8 text-center">
                <div className="inline-flex items-center gap-2 text-success font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  Je hebt deze toolbox voltooid!
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
