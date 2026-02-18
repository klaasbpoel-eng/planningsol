import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, BookOpen, X, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ToolboxItem } from "@/hooks/useToolbox";
import { useToolboxSections } from "@/hooks/useToolbox";
import { ToolboxSectionRenderer } from "./ToolboxSectionRenderer";
import siteLogo from "@/assets/site_logo.png";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

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
        } catch { }
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
    } catch { }
  });

  const progress = checklistTotal > 0
    ? Math.round((checklistDone / checklistTotal) * 100)
    : 0;

  if (!toolbox) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-950 [&>button:last-child]:hidden">

        {/* Branding Header */}
        <div className="h-16 border-b flex items-center justify-between px-6 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex items-center gap-3">
            <img src={siteLogo} alt="SOL Logo" className="h-10 w-auto" />
            <div className="h-8 w-px bg-border mx-2" />
            <div>
              <h2 className="font-bold text-primary text-lg leading-tight">Toolbox Meeting</h2>
              <p className="text-xs text-muted-foreground">{format(new Date(), "d MMMM yyyy", { locale: nl })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => window.print()} title="Afdrukken">
              <Printer className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} title="Sluiten">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {checklistTotal > 0 && (
          <div className="px-0 py-0 border-b shrink-0 bg-secondary/30">
            <Progress value={progress} className="h-1 rounded-none" />
          </div>
        )}

        {/* Content */}
        <ScrollArea className="flex-1 bg-muted/5">
          <div className="max-w-4xl mx-auto bg-card min-h-full shadow-sm my-8 border rounded-xl overflow-hidden">

            {/* Cover / Title Section */}
            <div className="relative">
              {(toolbox.cover_image_url || toolbox.thumbnail_url) ? (
                <div className="h-48 md:h-64 w-full overflow-hidden relative">
                  <img
                    src={toolbox.cover_image_url || toolbox.thumbnail_url || ""}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8">
                    <Badge className="mb-3 bg-primary text-primary-foreground border-none text-sm px-3 py-1">
                      {toolbox.category}
                    </Badge>
                    <h1 className="text-3xl md:text-4xl font-bold text-white shadow-sm leading-tight max-w-2xl">
                      {toolbox.title}
                    </h1>
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="mb-3 border-primary/20 text-primary bg-primary/5">
                        {toolbox.category}
                      </Badge>
                      <h1 className="text-3xl md:text-4xl font-bold text-primary leading-tight max-w-2xl">
                        {toolbox.title}
                      </h1>
                    </div>
                    <BookOpen className="h-24 w-24 text-primary/10 -mt-4 -mr-4" />
                  </div>
                </div>
              )}
            </div>

            {/* Meta Info Bar */}
            <div className="flex flex-wrap gap-4 px-8 py-4 bg-muted/30 border-b text-sm text-muted-foreground">
              {toolbox.is_mandatory && (
                <span className="flex items-center gap-1.5 text-accent-foreground font-medium">
                  <span className="h-2 w-2 rounded-full bg-accent" /> Verplicht
                </span>
              )}
              {toolbox.estimated_duration_minutes && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {toolbox.estimated_duration_minutes} minuten
                </span>
              )}
              {isCompleted && (
                <span className="flex items-center gap-1.5 text-green-600 font-medium ml-auto">
                  <CheckCircle2 className="h-4 w-4" /> Voltooid op {format(new Date(), "d-M-yyyy")}
                </span>
              )}
            </div>

            <div className="p-8 md:p-12 space-y-10">
              {toolbox.description && (
                <div className="prose prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed border-l-4 border-primary/20 pl-6 py-1">
                  {toolbox.description}
                </div>
              )}

              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : sections.length > 0 ? (
                <div className="space-y-12">
                  {sections.map((section, idx) => (
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
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Deze toolbox heeft nog geen inhoud.</p>
                </div>
              )}

              {/* Complete button section */}
              {sections.length > 0 && !isCompleted && (
                <div className="border-t pt-8 mt-8">
                  <div className="bg-primary/5 rounded-xl p-6 text-center">
                    <h3 className="text-lg font-semibold mb-2">Klaar met deze toolbox?</h3>
                    <p className="text-muted-foreground mb-6">Bevestig dat je alle onderdelen hebt doorgenomen.</p>
                    <Button size="lg" className="gap-2 px-8" onClick={handleMarkComplete}>
                      <CheckCircle2 className="h-5 w-5" />
                      Markeer als voltooid
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-center py-8 text-muted-foreground text-sm">
            <p className="font-semibold text-primary/40 mb-1">PlanningSOL</p>
            <p>&copy; {new Date().getFullYear()} PlanningSOL. Alle rechten voorbehouden.</p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
