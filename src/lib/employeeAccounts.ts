import type { AppRole } from "@/hooks/useUserPermissions";

/** Letters and digits that are hard to confuse when read aloud or copied by hand. */
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALL = LOWER + UPPER + DIGITS;

export const START_PASSWORD_LENGTH = 14;
export const MIN_PASSWORD_LENGTH = 8;

function randomIndex(max: number, random: (n: number) => number) {
  return random(max);
}

const cryptoRandom = (max: number) => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
};

/** A start password with at least one lowercase letter, uppercase letter and digit. */
export function generateStartPassword(random: (max: number) => number = cryptoRandom): string {
  const chars = [
    LOWER[randomIndex(LOWER.length, random)],
    UPPER[randomIndex(UPPER.length, random)],
    DIGITS[randomIndex(DIGITS.length, random)],
  ];
  while (chars.length < START_PASSWORD_LENGTH) chars.push(ALL[randomIndex(ALL.length, random)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, random);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export interface NewAccountInput {
  /** Existing employee to link the account to; empty for a brand-new person. */
  profileId?: string | null;
  fullName: string;
  email: string;
  password: string;
  role: AppRole;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns a Dutch message for the first problem, or null when the input is fine. */
export function validateNewAccount(input: NewAccountInput): string | null {
  if (!input.fullName.trim()) return "Vul een naam in.";
  if (!EMAIL_PATTERN.test(input.email.trim())) return "Vul een geldig e-mailadres in.";
  if (input.password.length < MIN_PASSWORD_LENGTH)
    return `Het wachtwoord moet minstens ${MIN_PASSWORD_LENGTH} tekens hebben.`;
  if (input.role === ("customer" as AppRole)) return "Klantaccounts maak je niet hier aan.";
  return null;
}

/** Turns sign-up errors from the login system into Dutch messages. */
export function accountErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists"))
    return "Er bestaat al een account met dit e-mailadres.";
  if (m.includes("rate limit"))
    return "Er zijn te veel e-mails verstuurd. Probeer het over een uur opnieuw.";
  if (m.includes("password"))
    return "Dit wachtwoord wordt niet geaccepteerd. Kies een langer of sterker wachtwoord.";
  if (m.includes("signup") && m.includes("disabled"))
    return "Aanmelden staat uit in het inlogsysteem, dus er kan geen account worden gemaakt.";
  if (m.includes("invalid") && m.includes("email")) return "Dit e-mailadres wordt niet geaccepteerd.";
  return message;
}

export interface SignUpResult {
  userId: string | null;
  /** False when the login system silently returned an existing account. */
  isNew: boolean;
  hasSession: boolean;
  error: string | null;
}

/** Minimal database surface used to link the account; mirrors the supabase client calls. */
export interface AccountDb {
  findProfileByUserId(userId: string): Promise<{ id: string } | null>;
  findUnlinkedProfileByEmail(email: string): Promise<{ id: string } | null>;
  linkProfile(profileId: string, values: Record<string, unknown>): Promise<void>;
  insertProfile(values: Record<string, unknown>): Promise<void>;
  deleteProfile(profileId: string): Promise<void>;
  getRoleRow(userId: string): Promise<{ id: string } | null>;
  updateRole(userId: string, role: AppRole): Promise<void>;
  insertRole(userId: string, role: AppRole): Promise<void>;
  deleteRole(userId: string): Promise<void>;
}

export interface CreatedAccount {
  userId: string;
  /** The person must click the link in the confirmation e-mail before signing in. */
  needsConfirmation: boolean;
}

export async function createEmployeeAccount(
  input: NewAccountInput,
  deps: {
    signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>;
    db: AccountDb;
    approvedBy?: string | null;
    now?: () => Date;
  },
): Promise<CreatedAccount> {
  const problem = validateNewAccount(input);
  if (problem) throw new Error(problem);

  const email = input.email.trim();
  const fullName = input.fullName.trim();
  const result = await deps.signUp(email, input.password, fullName);
  if (result.error) throw new Error(accountErrorMessage(result.error));
  if (!result.userId || !result.isNew) throw new Error("Er bestaat al een account met dit e-mailadres.");
  const userId = result.userId;

  const approval = {
    is_approved: true,
    approved_at: (deps.now?.() ?? new Date()).toISOString(),
    approved_by: deps.approvedBy ?? null,
  };

  // The database may already have made or linked an employee for the new account.
  const madeByDatabase = await deps.db.findProfileByUserId(userId);
  if (input.profileId) {
    if (madeByDatabase && madeByDatabase.id !== input.profileId) await deps.db.deleteProfile(madeByDatabase.id);
    await deps.db.linkProfile(input.profileId, { user_id: userId, email, full_name: fullName, ...approval });
  } else if (madeByDatabase) {
    await deps.db.linkProfile(madeByDatabase.id, { full_name: fullName, ...approval });
  } else {
    const unlinked = await deps.db.findUnlinkedProfileByEmail(email);
    if (unlinked) await deps.db.linkProfile(unlinked.id, { user_id: userId, full_name: fullName, ...approval });
    else await deps.db.insertProfile({ user_id: userId, email, full_name: fullName, ...approval });
  }

  const roleRow = await deps.db.getRoleRow(userId);
  if (input.role === "user") {
    if (roleRow) await deps.db.deleteRole(userId);
  } else if (roleRow) {
    await deps.db.updateRole(userId, input.role);
  } else {
    await deps.db.insertRole(userId, input.role);
  }

  return { userId, needsConfirmation: !result.hasSession };
}
