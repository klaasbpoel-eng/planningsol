/** Reads and saves own roles and who has them, in the app settings shared by everyone. */
import { api } from "@/lib/api";
import {
  CUSTOM_ROLE_ASSIGNMENTS_KEY,
  CUSTOM_ROLES_KEY,
  parseAssignments,
  parseCustomRoles,
  type CustomRole,
  type RoleAssignments,
} from "@/lib/customRoles";

export interface CustomRoleConfig {
  roles: CustomRole[];
  assignments: RoleAssignments;
}

const EMPTY: CustomRoleConfig = { roles: [], assignments: {} };
const CHANGE_EVENT = "custom-roles-changed";
let cached: Promise<CustomRoleConfig> | null = null;

/** Loads once and shares the result, so every menu and page check uses the same answer. */
export function loadCustomRoleConfig(force = false): Promise<CustomRoleConfig> {
  if (!cached || force) {
    cached = Promise.all([api.appSettings.getByKey(CUSTOM_ROLES_KEY), api.appSettings.getByKey(CUSTOM_ROLE_ASSIGNMENTS_KEY)])
      .then(([roles, assignments]) => ({ roles: parseCustomRoles(roles?.value), assignments: parseAssignments(assignments?.value) }))
      .catch(() => {
        cached = null;
        return EMPTY;
      });
  }
  return cached;
}

export async function saveCustomRoles(roles: CustomRole[]) {
  await api.appSettings.upsert(CUSTOM_ROLES_KEY, JSON.stringify(roles), "Eigen rollen (gemaakt op de pagina Rollen)");
  notifyChanged();
}

export async function saveRoleAssignments(assignments: RoleAssignments) {
  await api.appSettings.upsert(
    CUSTOM_ROLE_ASSIGNMENTS_KEY,
    JSON.stringify(assignments),
    "Wie welke eigen rol heeft (pagina Rollen)",
  );
  notifyChanged();
}

function notifyChanged() {
  cached = null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Runs the callback whenever roles or assignments are saved in this browser tab. */
export function onCustomRolesChanged(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}
