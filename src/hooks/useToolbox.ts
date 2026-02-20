import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ToolboxStatus = "draft" | "published" | "archived";
export type SectionType = "text" | "image" | "video" | "file" | "quiz" | "checklist";

export interface ToolboxItem {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  cover_image_url: string | null;
  category: string;
  status: ToolboxStatus;
  published_at: string | null;
  sort_order: number;
  estimated_duration_minutes: number | null;
  is_mandatory: boolean;
  validity_months: number;
  created_at: string;
  updated_at: string;
}

export interface ToolboxSection {
  id: string;
  toolbox_id: string;
  section_type: SectionType;
  title: string | null;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ToolboxCompletion {
  id: string;
  toolbox_id: string;
  user_id: string;
  completed_at: string;
  score: number | null;
}

export interface EnrichedCompletion extends ToolboxCompletion {
  toolbox: ToolboxItem;
  user_profile: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export function useToolboxes(includeAll = false) {
  const [toolboxes, setToolboxes] = useState<ToolboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("toolboxes" as any)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setToolboxes((data as any) || []);
    } catch (error) {
      console.error("Error fetching toolboxes:", error);
      toast.error("Fout bij het laden van toolboxes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { toolboxes, loading, refetch: fetch };
}

export function useToolboxSections(toolboxId: string | null) {
  const [sections, setSections] = useState<ToolboxSection[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!toolboxId) { setSections([]); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("toolbox_sections" as any)
        .select("*")
        .eq("toolbox_id", toolboxId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setSections((data as any) || []);
    } catch (error) {
      console.error("Error fetching sections:", error);
    } finally {
      setLoading(false);
    }
  }, [toolboxId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { sections, loading, refetch: fetch, setSections };
}

export function useToolboxCompletions(toolboxId?: string) {
  const [completions, setCompletions] = useState<ToolboxCompletion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!toolboxId) { setCompletions([]); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("toolbox_completions" as any)
        .select("*")
        .eq("toolbox_id", toolboxId);

      if (error) throw error;
      setCompletions((data as any) || []);
    } catch (error) {
      console.error("Error fetching completions:", error);
    } finally {
      setLoading(false);
    }
  }, [toolboxId]);

  useEffect(() => { fetch(); }, [fetch]);

  const markComplete = async (userId: string, score?: number) => {
    try {
      const { error } = await supabase
        .from("toolbox_completions" as any)
        .upsert({
          toolbox_id: toolboxId,
          user_id: userId,
          completed_at: new Date().toISOString(),
          score: score ?? null,
        }, { onConflict: "toolbox_id,user_id" });

      if (error) throw error;
      toast.success("Toolbox als voltooid gemarkeerd!");
      fetch();
    } catch (error: any) {
      console.error("Error marking complete:", error);
      toast.error("Fout bij markeren: " + error.message);
    }
  };

  return { completions, loading, refetch: fetch, markComplete };
}

export function useAllToolboxCompletions() {
  const [completions, setCompletions] = useState<EnrichedCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch completions
      const { data: completionsData, error: completionsError } = await supabase
        .from("toolbox_completions" as any)
        .select("*")
        .order("completed_at", { ascending: false });

      if (completionsError) throw completionsError;

      // Fetch toolboxes
      const { data: toolboxesData } = await supabase.from("toolboxes" as any).select("*");
      const toolboxesMap = new Map((toolboxesData as any[] || []).map(t => [t.id, t]));

      // Fetch profiles
      const { data: profilesData } = await supabase.from("profiles" as any).select("user_id, full_name, email");
      const profilesMap = new Map((profilesData as any[] || []).map(p => [p.user_id, p]));

      // Enrich data
      const enriched = (completionsData as any[] || []).map(c => ({
        ...c,
        toolbox: toolboxesMap.get(c.toolbox_id) || null,
        user_profile: profilesMap.get(c.user_id) || null,
      })).filter(c => c.toolbox); // Filter out completions for deleted toolboxes

      setCompletions(enriched);
    } catch (error) {
      console.error("Error fetching all completions:", error);
      toast.error("Fout bij ophalen logboek");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { completions, loading, refetch: fetch };
}

// Helper to save sections for a toolbox
export async function saveSections(toolboxId: string, sections: Omit<ToolboxSection, "id" | "created_at" | "updated_at">[]) {
  // Delete existing sections
  const { error: deleteError } = await supabase.from("toolbox_sections" as any).delete().eq("toolbox_id", toolboxId);
  if (deleteError) throw deleteError;

  if (sections.length === 0) return;

  const { error } = await supabase
    .from("toolbox_sections" as any)
    .insert(sections.map((s, i) => ({
      toolbox_id: toolboxId,
      section_type: s.section_type,
      title: s.title,
      content: s.content,
      sort_order: i,
    })));

  if (error) throw error;
}

export async function saveToolbox(data: Partial<ToolboxItem>, isEditing: boolean): Promise<string> {
  const payload: any = {
    title: data.title,
    description: data.description,
    category: data.category || "Algemeen",
    thumbnail_url: data.thumbnail_url,
    cover_image_url: data.cover_image_url,
    file_url: data.file_url,
    status: data.status || "draft",
    estimated_duration_minutes: data.estimated_duration_minutes,
    is_mandatory: data.is_mandatory || false,
    validity_months: data.validity_months || 12,
    sort_order: data.sort_order || 0,
    updated_at: new Date().toISOString(),
  };

  if (data.status === "published" && !data.published_at) {
    payload.published_at = new Date().toISOString();
  }

  if (isEditing && data.id) {
    const { error } = await supabase
      .from("toolboxes" as any)
      .update(payload)
      .eq("id", data.id);
    if (error) throw error;
    return data.id;
  } else {
    const { data: created, error } = await supabase
      .from("toolboxes" as any)
      .insert([payload])
      .select("id")
      .single();
    if (error) throw error;
    return (created as any).id;
  }
}

export async function duplicateToolbox(id: string): Promise<string> {
  // Fetch original
  const { data: original, error } = await supabase
    .from("toolboxes" as any)
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  const o = original as any;
  const newId = crypto.randomUUID();
  const { error: insertError } = await supabase
    .from("toolboxes" as any)
    .insert([{
      id: newId,
      title: o.title + " (kopie)",
      description: o.description,
      category: o.category,
      thumbnail_url: o.thumbnail_url,
      cover_image_url: o.cover_image_url,
      file_url: o.file_url,
      status: "draft",
      estimated_duration_minutes: o.estimated_duration_minutes,
      is_mandatory: false,
      validity_months: o.validity_months || 12,
      sort_order: 0,
    }]);
  if (insertError) throw insertError;

  // Copy sections
  const { data: sections } = await supabase
    .from("toolbox_sections" as any)
    .select("*")
    .eq("toolbox_id", id)
    .order("sort_order");

  if (sections && (sections as any[]).length > 0) {
    await supabase.from("toolbox_sections" as any).insert(
      (sections as any[]).map((s: any) => ({
        toolbox_id: newId,
        section_type: s.section_type,
        title: s.title,
        content: s.content,
        sort_order: s.sort_order,
      }))
    );
  }

  return newId;
}

export async function deleteToolbox(id: string) {
  const { error } = await supabase.from("toolboxes" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function uploadToolboxFile(file: File, folder = ""): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${folder ? folder + "/" : ""}${crypto.randomUUID()}.${fileExt}`;

  const { error } = await supabase.storage.from("toolbox-files").upload(fileName, file);
  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from("toolbox-files").getPublicUrl(fileName);
  return publicUrl;
}

// Session Types
export interface ToolboxSession {
  id: string;
  toolbox_id: string;
  session_date: string;
  session_time: string | null;
  location: string | null;
  instructor_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;

  // Joins
  toolbox?: ToolboxItem;
  instructor?: {
    full_name: string | null;
  };
  _count?: {
    participants: number;
  };
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  profile_id: string;
  attended: boolean;
  signed_off: boolean;

  // Joins
  profile?: {
    full_name: string | null;
    email: string | null;
    production_location: string | null;
    department: string | null;
  };
}

// Session Hooks
export function useToolboxSessions() {
  const [sessions, setSessions] = useState<ToolboxSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("toolbox_sessions" as any)
        .select(`
          *,
          toolbox:toolboxes(title),
          instructor:profiles!toolbox_sessions_instructor_id_fkey(full_name),
          participants:toolbox_session_participants(count)
        `)
        .order("session_date", { ascending: false });

      if (error) throw error;

      // Transform to match interface
      const transformed = (data as any[]).map(s => ({
        ...s,
        toolbox: s.toolbox,
        instructor: s.instructor,
        _count: { participants: s.participants?.[0]?.count || 0 }
      }));

      setSessions(transformed);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("Fout bij laden van sessies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { sessions, loading, refetch: fetch };
}

export function useToolboxSessionParticipants(sessionId: string | null) {
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!sessionId) { setParticipants([]); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("toolbox_session_participants" as any)
        .select(`
          *,
          profile:profiles(full_name, email, production_location, department)
        `)
        .eq("session_id", sessionId);

      if (error) throw error;
      setParticipants((data as any) || []);
    } catch (error) {
      console.error("Error fetching participants:", error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { participants, loading, refetch: fetch };
}

export async function createToolboxSession(
  sessionData: Partial<ToolboxSession>,
  participants: { profileId: string; userId: string }[]
) {
  // 1. Create Session
  const { data: session, error: sessionError } = await supabase
    .from("toolbox_sessions" as any)
    .insert([{
      toolbox_id: sessionData.toolbox_id,
      session_date: sessionData.session_date,
      session_time: sessionData.session_time,
      location: sessionData.location,
      instructor_id: sessionData.instructor_id,
      notes: sessionData.notes,
      created_by: (await supabase.auth.getUser()).data.user?.id
    }])
    .select()
    .single();

  if (sessionError) throw sessionError;

  // 2. Add Participants
  if (participants.length > 0) {
    const { error: partError } = await supabase
      .from("toolbox_session_participants" as any)
      .insert(participants.map(p => ({
        session_id: (session as any).id,
        profile_id: p.profileId,
        attended: true
      })));

    if (partError) throw partError;

    // 3. Mark as Completed (Upsert) - only for participants with a valid userId
    const participantsWithUser = participants.filter(p => p.userId);
    if (participantsWithUser.length > 0) {
    const { error: completeError } = await supabase
      .from("toolbox_completions" as any)
      .upsert(participantsWithUser.map(p => ({
        toolbox_id: sessionData.toolbox_id,
        user_id: p.userId,
        completed_at: sessionData.session_date, // Use session date
        score: null
      })), { onConflict: "toolbox_id,user_id" });

    if (completeError) throw completeError;
    }
  }

  return (session as any).id;
}
