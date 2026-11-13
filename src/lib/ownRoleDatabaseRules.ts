/**
 * Database rules that make own roles (Rollen page) hold in the real database too.
 * Each switched-off right gets a guard on the tables it covers; the guard reads the same
 * app settings the app uses, so rules and screens always agree. Standard roles are untouched:
 * the guard only refuses something when the person's own role has that right switched off.
 */
import { CONFIGURABLE_PERMISSIONS, CUSTOM_ROLE_ASSIGNMENTS_KEY, CUSTOM_ROLES_KEY, type PermissionKey } from "@/lib/customRoles";

export type GuardedAction = "insert" | "update" | "delete";

export interface TableGuard {
  table: string;
  actions: GuardedAction[];
  /** "status": only moving a request to approved or rejected needs the right. */
  mode: "all" | "status";
}

export type PermissionRule =
  | { kind: "database"; guards: TableGuard[] }
  | { kind: "app"; reason: string };

const all = (table: string, actions: GuardedAction[] = ["insert", "update", "delete"]): TableGuard => ({ table, actions, mode: "all" });
const status = (table: string): TableGuard => ({ table, actions: ["insert", "update"], mode: "status" });

/** Which tables each right protects. Every right on the Rollen page has an entry. */
export const PERMISSION_RULES: Record<PermissionKey, PermissionRule | undefined> = {
  canCreateOrders: { kind: "database", guards: [all("dry_ice_orders", ["insert"])] },
  canEditOrders: { kind: "database", guards: [all("dry_ice_orders", ["update"]), all("gas_cylinder_orders", ["update"])] },
  canManageCustomers: { kind: "database", guards: [all("customers"), all("customer_locations"), all("customer_products")] },
  canApproveRequests: { kind: "database", guards: [status("time_off_requests"), status("pgs_expansion_requests")] },
  canManageUsers: { kind: "database", guards: [all("pgs_substances"), all("storage_places"), all("bulk_storage_tanks")] },
  canViewReports: {
    kind: "app",
    reason: "Rapporten worden door de database samengevat; dat tabblad wordt in de app verborgen.",
  },
  canViewPGSRegister: {
    kind: "app",
    reason: "De plattegrond en voorraad lezen dezelfde gegevens; het tabblad wordt in de app verborgen.",
  },
} as Record<PermissionKey, PermissionRule | undefined>;

const labelOf = (key: PermissionKey) => CONFIGURABLE_PERMISSIONS.find((p) => p.key === key)?.label ?? key;
const triggerName = (key: PermissionKey, table: string) => `eigen_rol_${key}_${table}`.toLowerCase().slice(0, 63);
const sqlText = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** All guards, in the order of the Rollen page. */
export function databaseGuards(): { key: PermissionKey; label: string; guard: TableGuard }[] {
  return CONFIGURABLE_PERMISSIONS.flatMap(({ key }) => {
    const rule = PERMISSION_RULES[key];
    return rule?.kind === "database" ? rule.guards.map((guard) => ({ key, label: labelOf(key), guard })) : [];
  });
}

const FUNCTIONS_SQL = `-- 1. Mag de ingelogde persoon dit recht gebruiken volgens zijn eigen rol?
--    Zonder eigen rol (of als die niet meer bij de standaardrol past) geldt gewoon de standaardrol.
create or replace function public.own_role_allows(_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_assignments jsonb;
  v_roles jsonb;
  v_role_id text;
  v_role jsonb;
  v_base text;
begin
  if v_uid is null then
    return true; -- serverprocessen zonder ingelogde persoon
  end if;

  begin
    select value::jsonb into v_assignments from public.app_settings where key = ${sqlText(CUSTOM_ROLE_ASSIGNMENTS_KEY)};
  exception when others then
    return true; -- onleesbare lijst: niemand heeft een eigen rol
  end;
  if v_assignments is null or jsonb_typeof(v_assignments) <> 'object' then
    return true;
  end if;
  v_role_id := v_assignments ->> v_uid::text;
  if v_role_id is null then
    return true;
  end if;

  begin
    select value::jsonb into v_roles from public.app_settings where key = ${sqlText(CUSTOM_ROLES_KEY)};
  exception when others then
    return false; -- persoon heeft een eigen rol maar de rollen zijn onleesbaar: voor de zekerheid weigeren
  end;
  if v_roles is null then
    return true;
  end if;
  if jsonb_typeof(v_roles) <> 'array' then
    return false;
  end if;

  select r into v_role from jsonb_array_elements(v_roles) r where r ->> 'id' = v_role_id limit 1;
  if v_role is null then
    return true; -- rol verwijderd: standaardrol geldt
  end if;

  select ur.role::text into v_base from public.user_roles ur where ur.user_id = v_uid limit 1;
  if coalesce(v_base, 'user') is distinct from v_role ->> 'baseRole' then
    return true; -- eigen rol past niet meer bij de standaardrol, de app negeert hem dan ook
  end if;

  return not coalesce(
    jsonb_typeof(v_role -> 'disabledPermissions') = 'array' and (v_role -> 'disabledPermissions') ? _permission,
    false
  );
end;
$$;

-- 2. Bewaker op tabellen: weigert met een duidelijke melding als het recht uit staat.
create or replace function public.own_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permission text := tg_argv[0];
  v_mode text := coalesce(tg_argv[1], 'all');
  v_label text := coalesce(tg_argv[2], tg_argv[0]);
begin
  if v_mode = 'status' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    if coalesce(to_jsonb(new) ->> 'status', '') not in ('approved', 'rejected') then
      return new;
    end if;
    if tg_op = 'UPDATE' and (to_jsonb(old) ->> 'status') is not distinct from (to_jsonb(new) ->> 'status') then
      return new;
    end if;
  end if;

  if public.own_role_allows(v_permission) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'Je rol mag dit niet: %', v_label
    using errcode = '42501', hint = 'Vraag een beheerder om dit recht aan te zetten op de pagina Rollen.';
end;
$$;

-- 3. Alleen beheerders mogen de eigen rollen en de toewijzingen wijzigen.
create or replace function public.own_role_settings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := case when tg_op = 'DELETE' then old.key else new.key end;
  v_old_key text := case when tg_op = 'UPDATE' then old.key else null end;
begin
  if auth.uid() is not null
     and (v_key in (${sqlText(CUSTOM_ROLES_KEY)}, ${sqlText(CUSTOM_ROLE_ASSIGNMENTS_KEY)})
          or v_old_key in (${sqlText(CUSTOM_ROLES_KEY)}, ${sqlText(CUSTOM_ROLE_ASSIGNMENTS_KEY)}))
     and not exists (select 1 from public.user_roles where user_id = auth.uid() and role::text = 'admin') then
    raise exception 'Alleen beheerders mogen rollen wijzigen' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.own_role_allows(text) from public, anon, authenticated;
grant execute on function public.own_role_allows(text) to service_role;
revoke all on function public.own_role_guard() from public, anon, authenticated;
revoke all on function public.own_role_settings_guard() from public, anon, authenticated;

drop trigger if exists eigen_rol_instellingen on public.app_settings;
create trigger eigen_rol_instellingen
  before insert or update or delete on public.app_settings
  for each row execute function public.own_role_settings_guard();`;

function guardSql({ key, label, guard }: { key: PermissionKey; label: string; guard: TableGuard }): string {
  const name = triggerName(key, guard.table);
  const events = guard.actions.join(" or ");
  return `-- ${label}: ${guard.table} (${guard.actions.join(", ")})
do $guard$
begin
  if to_regclass('public.${guard.table}') is not null then
    drop trigger if exists ${name} on public.${guard.table};
    create trigger ${name}
      before ${events} on public.${guard.table}
      for each row execute function public.own_role_guard(${sqlText(key)}, ${sqlText(guard.mode)}, ${sqlText(label.toLocaleLowerCase("nl-NL"))});
  else
    raise notice 'Tabel ${guard.table} bestaat niet, overgeslagen';
  end if;
end
$guard$;`;
}

/** SQL to run once in the app's database; safe to run again after changes. */
export function buildOwnRoleRulesSql(): string {
  const appOnly = CONFIGURABLE_PERMISSIONS.flatMap(({ key, label }) => {
    const rule = PERMISSION_RULES[key];
    return rule?.kind === "app" ? [`--   - ${label}: ${rule.reason}`] : [];
  });
  return [
    "-- Databaseregels voor eigen rollen (pagina Rollen).",
    "-- Voer dit één keer uit in de SQL-editor van de database van de app. Opnieuw uitvoeren kan veilig.",
    "-- Standaardrollen veranderen niet: er wordt alleen iets geweigerd als de eigen rol van iemand dat recht uit heeft staan.",
    ...(appOnly.length ? ["-- Alleen in de app (niet in de database):", ...appOnly] : []),
    "",
    FUNCTIONS_SQL,
    "",
    "-- 4. Bewakers per recht",
    ...databaseGuards().map(guardSql),
    "",
  ].join("\n");
}

/** SQL that removes every rule again. */
export function buildOwnRoleRulesRemovalSql(): string {
  const drops = databaseGuards().map(
    ({ key, guard }) => `  if to_regclass('public.${guard.table}') is not null then
    drop trigger if exists ${triggerName(key, guard.table)} on public.${guard.table};
  end if;`,
  );
  return [
    "-- Haalt de databaseregels voor eigen rollen weer weg.",
    "do $guard$",
    "begin",
    ...drops,
    "end",
    "$guard$;",
    "drop trigger if exists eigen_rol_instellingen on public.app_settings;",
    "drop function if exists public.own_role_guard();",
    "drop function if exists public.own_role_settings_guard();",
    "drop function if exists public.own_role_allows(text);",
    "",
  ].join("\n");
}
