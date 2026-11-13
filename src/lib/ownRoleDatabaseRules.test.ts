import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { getPermissionsForRole } from "@/hooks/useUserPermissions";
import { CONFIGURABLE_PERMISSIONS } from "./customRoles";
import { PERMISSION_RULES, buildOwnRoleRulesRemovalSql, buildOwnRoleRulesSql } from "./ownRoleDatabaseRules";

const ADMIN = "00000000-0000-0000-0000-00000000000a";
const PLANNER = "00000000-0000-0000-0000-00000000000b";
const OPERATOR = "00000000-0000-0000-0000-00000000000c";

describe("standaardrechten", () => {
  it("alleen admins mogen aanvragen goedkeuren", () => {
    expect(getPermissionsForRole("admin").canApproveRequests).toBe(true);
    expect(getPermissionsForRole("supervisor").canApproveRequests).toBe(false);
    expect(getPermissionsForRole("operator").canApproveRequests).toBe(false);
  });

  it("operators mogen klanten toevoegen, gebruikers niet", () => {
    expect(getPermissionsForRole("operator").canManageCustomers).toBe(true);
    expect(getPermissionsForRole("user").canManageCustomers).toBe(false);
  });

  it("rapporten en PGS-register zijn voor supervisors en admins", () => {
    for (const key of ["canViewReports", "canViewPGSRegister"] as const) {
      expect(getPermissionsForRole("supervisor")[key]).toBe(true);
      expect(getPermissionsForRole("operator")[key]).toBe(false);
    }
  });

  it("elk recht op de pagina Rollen heeft een databaseregel of staat als alleen-app gemarkeerd", () => {
    for (const { key } of CONFIGURABLE_PERMISSIONS) expect(PERMISSION_RULES[key], key).toBeDefined();
  });
});

describe("databaseregels voor eigen rollen", () => {
  let db: PGlite;

  const as = async (uid: string, sql: string) => {
    try {
      await db.exec(`set test.uid = '${uid}'; ${sql}`);
      return "ok";
    } catch (e: any) {
      return e.message as string;
    } finally {
      await db.exec("reset test.uid");
    }
  };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
      create type app_role as enum ('admin','user','operator','supervisor','customer');
      create table public.user_roles (user_id uuid, role app_role);
      create table public.app_settings (id serial, key text unique, value text);
      create table public.customers (id serial, name text);
      create table public.customer_locations (id serial, location text);
      create table public.dry_ice_orders (id serial, note text);
      create table public.gas_cylinder_orders (id serial, note text);
      create table public.time_off_requests (id serial, status text default 'pending', reason text);
      create table public.pgs_substances (id serial, n text);
      create table public.bulk_storage_tanks (id serial, n text);
    `);
    // Running twice must work, so the rules can be re-applied after an update.
    await db.exec(buildOwnRoleRulesSql());
    await db.exec(buildOwnRoleRulesSql());
    const roles = [
      { id: "r1", name: "Planner", baseRole: "operator", disabledPermissions: ["canManageCustomers", "canEditOrders"] },
      { id: "r2", name: "Chef", baseRole: "admin", disabledPermissions: ["canApproveRequests"] },
    ];
    await db.exec(`
      insert into user_roles values ('${ADMIN}','admin'),('${PLANNER}','operator'),('${OPERATOR}','operator');
      insert into app_settings(key, value) values
        ('custom_roles', '${JSON.stringify(roles)}'),
        ('custom_role_assignments', '${JSON.stringify({ [PLANNER]: "r1", [ADMIN]: "r2" })}');
      insert into dry_ice_orders(note) values ('x');
      insert into time_off_requests(reason) values ('vakantie');
    `);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("weigert klanten toevoegen en verwijderen als dat recht uit staat", async () => {
    expect(await as(PLANNER, "insert into customers(name) values ('a')")).toBe("Je rol mag dit niet: klanten beheren");
    expect(await as(PLANNER, "delete from customers")).toBe("Je rol mag dit niet: klanten beheren");
  });

  it("laat een operator zonder eigen rol gewoon klanten toevoegen", async () => {
    expect(await as(OPERATOR, "insert into customers(name) values ('b')")).toBe("ok");
  });

  it("weigert orders wijzigen, maar niet aanmaken als alleen wijzigen uit staat", async () => {
    expect(await as(PLANNER, "update dry_ice_orders set note = 'y'")).toBe("Je rol mag dit niet: orders wijzigen");
    expect(await as(PLANNER, "insert into dry_ice_orders(note) values ('z')")).toBe("ok");
  });

  it("weigert alleen het goedkeuren van verlof, niet het aanpassen van een aanvraag", async () => {
    expect(await as(ADMIN, "update time_off_requests set status = 'approved'")).toBe("Je rol mag dit niet: aanvragen goedkeuren");
    expect(await as(ADMIN, "update time_off_requests set reason = 'anders'")).toBe("ok");
  });

  it("laat alleen beheerders de rollen wijzigen", async () => {
    expect(await as(PLANNER, "update app_settings set value = '[]' where key = 'custom_roles'")).toBe("Alleen beheerders mogen rollen wijzigen");
    expect(await as(ADMIN, "update app_settings set value = value where key = 'custom_roles'")).toBe("ok");
  });

  it("negeert de eigen rol zodra de standaardrol niet meer past", async () => {
    await db.exec(`update user_roles set role = 'supervisor' where user_id = '${PLANNER}'`);
    expect(await as(PLANNER, "insert into customers(name) values ('c')")).toBe("ok");
    await db.exec(`update user_roles set role = 'operator' where user_id = '${PLANNER}'`);
  });

  it("weigert voor de zekerheid als de rollenlijst onleesbaar is", async () => {
    await db.exec("update app_settings set value = 'kapot' where key = 'custom_roles'");
    expect(await as(PLANNER, "insert into customers(name) values ('d')")).toBe("Je rol mag dit niet: klanten beheren");
    expect(await as(OPERATOR, "insert into customers(name) values ('e')")).toBe("ok");
  });

  it("haalt alle regels weer weg met de verwijder-SQL", async () => {
    await db.exec(buildOwnRoleRulesRemovalSql());
    expect(await as(PLANNER, "insert into customers(name) values ('f')")).toBe("ok");
  });
});
