import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/external-supabase/client";
import type { AppRole } from "@/hooks/useUserPermissions";
import { createEmployeeAccount, type AccountDb, type NewAccountInput, type SignUpResult } from "./employeeAccounts";

let signUpClient: SupabaseClient | null = null;

/** A separate login client that keeps nothing, so the admin stays signed in as themselves. */
function getSignUpClient() {
  signUpClient ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "sol-account-aanmaken" },
  });
  return signUpClient;
}

async function signUp(email: string, password: string, fullName: string): Promise<SignUpResult> {
  const { data, error } = await getSignUpClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
  });
  if (error) return { userId: null, isNew: false, hasSession: false, error: error.message };
  const identities = data.user?.identities;
  if (data.session) await getSignUpClient().auth.signOut({ scope: "local" }).catch(() => {});
  return {
    userId: data.user?.id ?? null,
    isNew: !!data.user && (identities === undefined || identities.length > 0),
    hasSession: !!data.session,
    error: null,
  };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const db: AccountDb = {
  async findProfileByUserId(userId) {
    const { data, error } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
    check(error);
    return data;
  },
  async findUnlinkedProfileByEmail(email) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .is("user_id", null)
      .ilike("email", escapeLike(email))
      .order("created_at", { ascending: true })
      .limit(1);
    check(error);
    return data?.[0] ?? null;
  },
  async linkProfile(profileId, values) {
    const { error } = await supabase.from("profiles").update(values as any).eq("id", profileId);
    check(error);
  },
  async insertProfile(values) {
    const { error } = await supabase.from("profiles").insert(values as any);
    check(error);
  },
  async deleteProfile(profileId) {
    const { error } = await supabase.from("profiles").delete().eq("id", profileId);
    check(error);
  },
  async getRoleRow(userId) {
    const { data, error } = await supabase.from("user_roles").select("id").eq("user_id", userId).maybeSingle();
    check(error);
    return data;
  },
  async updateRole(userId, role: AppRole) {
    const { error } = await supabase.from("user_roles").update({ role: role as any }).eq("user_id", userId);
    check(error);
  },
  async insertRole(userId, role: AppRole) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    check(error);
  },
  async deleteRole(userId) {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
    check(error);
  },
};

async function currentProfileId() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  return profile?.id ?? null;
}

export async function createAccountForEmployee(input: NewAccountInput) {
  const approvedBy = await currentProfileId();
  return createEmployeeAccount(input, { signUp, db, approvedBy });
}
