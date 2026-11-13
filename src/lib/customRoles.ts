/**
 * Roles that admins make themselves in the app. Each one builds on a standard role, which still decides
 * what the database lets the person do; the own role can only switch rights off and hide menu items.
 * That keeps it safe without extra database rules: an own role can never give more than its standard role.
 */
import type { AppRole, RolePermissions } from "@/hooks/useUserPermissions";
import type { NavigationGroup } from "@/config/navigation";

export const CUSTOM_ROLES_KEY = "custom_roles";
export const CUSTOM_ROLE_ASSIGNMENTS_KEY = "custom_role_assignments";

export const STANDARD_ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  operator: "Operator",
  user: "Gebruiker",
};

export const STANDARD_ROLES: AppRole[] = ["user", "operator", "supervisor", "admin"];

export type PermissionKey = keyof RolePermissions;

/** Rights that pages in the app actually check, with a description in plain words. */
export const CONFIGURABLE_PERMISSIONS: { key: PermissionKey; label: string; description: string }[] = [
  { key: "canCreateOrders", label: "Droogijsorders aanmaken", description: "Knop \"Nieuwe order\" bij Productie → Droogijs." },
  { key: "canEditOrders", label: "Orders wijzigen", description: "Orders openen en aanpassen vanaf Vandaag." },
  { key: "canViewReports", label: "Rapporten bekijken", description: "Tabblad Rapportage bij Productie, met grafieken en exports." },
  { key: "canApproveRequests", label: "Aanvragen goedkeuren", description: "Verlofaanvragen en PGS-uitbreidingsaanvragen goedkeuren of afwijzen." },
  { key: "canManageCustomers", label: "Klanten beheren", description: "Klanten toevoegen, wijzigen, samenvoegen en verwijderen, ook vanuit een order." },
  { key: "canViewPGSRegister", label: "PGS-register bekijken", description: "Tabblad Register op de PGS-pagina." },
  { key: "canManageUsers", label: "PGS-register bewerken", description: "Stoffen en opslagplaatsen in het register aanpassen." },
];

/**
 * Version of the stored rights list. In version 1 "canViewReports" stood for the PGS register tab;
 * roles saved before that keep the register switched off as well.
 */
export const ROLE_FORMAT_VERSION = 2;

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  /** Standard role this one builds on; decides database access. */
  baseRole: AppRole;
  /** Rights switched off compared to the standard role. */
  disabledPermissions: PermissionKey[];
  /** Menu items (navigation ids) that are hidden for this role. */
  hiddenMenuItems: string[];
}

/** Which own role (by id) each person has, keyed by their login id. */
export type RoleAssignments = Record<string, string>;

const isAppRole = (value: unknown): value is AppRole => STANDARD_ROLES.includes(value as AppRole);
const KNOWN_PERMISSIONS = new Set(CONFIGURABLE_PERMISSIONS.map((p) => p.key));

/** Stored roles; anything unreadable is left out. */
export function parseCustomRoles(value: unknown): CustomRole[] {
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: any) => {
    if (!item || typeof item.id !== "string" || typeof item.name !== "string" || !item.name.trim() || !isAppRole(item.baseRole)) return [];
    return [
      {
        id: item.id,
        name: item.name.trim(),
        description: typeof item.description === "string" ? item.description : "",
        baseRole: item.baseRole,
        disabledPermissions: readDisabledPermissions(item),
        hiddenMenuItems: Array.isArray(item.hiddenMenuItems) ? item.hiddenMenuItems.filter((k: unknown) => typeof k === "string") : [],
      },
    ];
  });
}

function readDisabledPermissions(item: any): PermissionKey[] {
  const keys: PermissionKey[] = Array.isArray(item.disabledPermissions)
    ? item.disabledPermissions.filter((k: unknown) => KNOWN_PERMISSIONS.has(k as PermissionKey))
    : [];
  if (item.formatVersion !== ROLE_FORMAT_VERSION && keys.includes("canViewReports") && !keys.includes("canViewPGSRegister")) {
    keys.push("canViewPGSRegister");
  }
  return [...new Set(keys)];
}

/** Roles as stored, marked with the current format so older lists can be recognised later. */
export function serializeCustomRoles(roles: CustomRole[]): string {
  return JSON.stringify(roles.map((role) => ({ ...role, formatVersion: ROLE_FORMAT_VERSION })));
}

export function parseAssignments(value: unknown): RoleAssignments {
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([k, v]) => typeof k === "string" && typeof v === "string")) as RoleAssignments;
}

/**
 * The own role that applies to a person. It only counts while their standard role still matches the
 * role's base, so changing someone's role elsewhere never leaves them with a mismatched set of rights.
 */
export function resolveCustomRole(
  userId: string | undefined,
  baseRole: AppRole,
  roles: CustomRole[],
  assignments: RoleAssignments,
): CustomRole | null {
  if (!userId) return null;
  const role = roles.find((r) => r.id === assignments[userId]);
  return role && role.baseRole === baseRole ? role : null;
}

/** Rights of the standard role with the own role's switched-off rights removed. Never adds rights. */
export function effectivePermissions(base: RolePermissions, role: CustomRole | null): RolePermissions {
  if (!role) return base;
  const result = { ...base };
  for (const key of role.disabledPermissions) result[key] = false;
  return result;
}

/** Menu groups without the items hidden for the role; groups left empty disappear. */
export function filterNavigationForRole(groups: NavigationGroup[], role: CustomRole | null): NavigationGroup[] {
  if (!role || role.hiddenMenuItems.length === 0) return groups;
  const hidden = new Set(role.hiddenMenuItems);
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !hidden.has(item.id)) }))
    .filter((group) => group.items.length > 0);
}

/** Name shown next to the person's e-mail: the own role, else the standard role. */
export function roleDisplayName(baseRole: AppRole, role: CustomRole | null): string {
  return role?.name ?? STANDARD_ROLE_LABELS[baseRole] ?? "Gebruiker";
}

/** Problem with a role being saved, in plain words; null when it can be saved. */
export function validateCustomRole(draft: Pick<CustomRole, "id" | "name">, existing: CustomRole[]): string | null {
  const name = draft.name.trim();
  if (!name) return "Geef de rol een naam.";
  if (name.length > 40) return "Gebruik maximaal 40 tekens voor de naam.";
  const lower = name.toLocaleLowerCase("nl-NL");
  if (Object.values(STANDARD_ROLE_LABELS).some((label) => label.toLocaleLowerCase("nl-NL") === lower)) {
    return `"${name}" is al een standaardrol.`;
  }
  if (existing.some((r) => r.id !== draft.id && r.name.toLocaleLowerCase("nl-NL") === lower)) {
    return `Er bestaat al een rol "${name}".`;
  }
  return null;
}

/** Roles list with one role added or replaced. */
export function upsertRole(roles: CustomRole[], role: CustomRole): CustomRole[] {
  const index = roles.findIndex((r) => r.id === role.id);
  if (index === -1) return [...roles, { ...role, name: role.name.trim() }];
  const next = [...roles];
  next[index] = { ...role, name: role.name.trim() };
  return next;
}

/** Roles and assignments without the deleted role; people keep their standard role. */
export function removeRole(roles: CustomRole[], assignments: RoleAssignments, roleId: string) {
  return {
    roles: roles.filter((r) => r.id !== roleId),
    assignments: Object.fromEntries(Object.entries(assignments).filter(([, id]) => id !== roleId)),
  };
}

/** What to store when a person gets a role: a standard role ("std:admin") or an own role ("custom:<id>"). */
export function planAssignment(
  choice: string,
  userId: string,
  roles: CustomRole[],
  assignments: RoleAssignments,
): { baseRole: AppRole; assignments: RoleAssignments } | null {
  const next = { ...assignments };
  delete next[userId];
  if (choice.startsWith("std:")) {
    const baseRole = choice.slice(4);
    return isAppRole(baseRole) ? { baseRole, assignments: next } : null;
  }
  if (choice.startsWith("custom:")) {
    const role = roles.find((r) => r.id === choice.slice(7));
    if (!role) return null;
    next[userId] = role.id;
    return { baseRole: role.baseRole, assignments: next };
  }
  return null;
}

/** The choice value matching a person's current roles, for the role picker. */
export function currentChoice(userId: string, baseRole: AppRole, roles: CustomRole[], assignments: RoleAssignments): string {
  const role = resolveCustomRole(userId, baseRole, roles, assignments);
  return role ? `custom:${role.id}` : `std:${baseRole}`;
}
