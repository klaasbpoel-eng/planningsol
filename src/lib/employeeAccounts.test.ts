import { describe, expect, it, vi } from "vitest";
import {
  accountErrorMessage,
  createEmployeeAccount,
  generateStartPassword,
  validateNewAccount,
  type AccountDb,
  type NewAccountInput,
} from "./employeeAccounts";

const base: NewAccountInput = { fullName: "Jan Jansen", email: "jan@sol.nl", password: "Startwachtwoord1", role: "operator" };

function makeDb(overrides: Partial<Record<keyof AccountDb, any>> = {}) {
  const db: Record<keyof AccountDb, any> = {
    findProfileByUserId: vi.fn().mockResolvedValue(null),
    findUnlinkedProfileByEmail: vi.fn().mockResolvedValue(null),
    linkProfile: vi.fn().mockResolvedValue(undefined),
    insertProfile: vi.fn().mockResolvedValue(undefined),
    deleteProfile: vi.fn().mockResolvedValue(undefined),
    getRoleRow: vi.fn().mockResolvedValue(null),
    updateRole: vi.fn().mockResolvedValue(undefined),
    insertRole: vi.fn().mockResolvedValue(undefined),
    deleteRole: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return db as AccountDb & typeof db;
}

const okSignUp = vi.fn().mockResolvedValue({ userId: "u-1", isNew: true, hasSession: false, error: null });

describe("startwachtwoord", () => {
  it("is 14 tekens met kleine letter, hoofdletter en cijfer", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateStartPassword();
      expect(pw).toHaveLength(14);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).not.toMatch(/[0O1lI]/);
    }
  });
});

describe("controle nieuw account", () => {
  it("vraagt een naam, geldig e-mailadres en minstens 8 tekens wachtwoord", () => {
    expect(validateNewAccount({ ...base, fullName: " " })).toBe("Vul een naam in.");
    expect(validateNewAccount({ ...base, email: "jan@" })).toBe("Vul een geldig e-mailadres in.");
    expect(validateNewAccount({ ...base, password: "1234567" })).toMatch(/minstens 8/);
    expect(validateNewAccount({ ...base, password: "12345678" })).toBeNull();
  });

  it("vertaalt een bestaand account naar een Nederlandse melding", () => {
    expect(accountErrorMessage("User already registered")).toBe("Er bestaat al een account met dit e-mailadres.");
  });
});

describe("account aanmaken", () => {
  it("koppelt het account aan de gekozen medewerker, keurt goed en geeft de rol", async () => {
    const db = makeDb();
    const result = await createEmployeeAccount({ ...base, profileId: "p-9" }, { signUp: okSignUp, db, approvedBy: "p-admin" });
    expect(result).toEqual({ userId: "u-1", needsConfirmation: true });
    expect(db.linkProfile).toHaveBeenCalledWith("p-9", expect.objectContaining({ user_id: "u-1", is_approved: true, approved_by: "p-admin" }));
    expect(db.insertRole).toHaveBeenCalledWith("u-1", "operator");
    expect(db.insertProfile).not.toHaveBeenCalled();
  });

  it("ruimt een door de database gemaakte dubbele medewerker op", async () => {
    const db = makeDb({ findProfileByUserId: vi.fn().mockResolvedValue({ id: "p-auto" }) });
    await createEmployeeAccount({ ...base, profileId: "p-9" }, { signUp: okSignUp, db });
    expect(db.deleteProfile).toHaveBeenCalledWith("p-auto");
    expect(db.linkProfile).toHaveBeenCalledWith("p-9", expect.objectContaining({ user_id: "u-1" }));
  });

  it("maakt een nieuwe medewerker als er geen bestaat", async () => {
    const db = makeDb();
    await createEmployeeAccount({ ...base, role: "user" }, { signUp: okSignUp, db });
    expect(db.insertProfile).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u-1", email: "jan@sol.nl", is_approved: true }));
    expect(db.insertRole).not.toHaveBeenCalled();
  });

  it("stopt zonder iets te wijzigen als het e-mailadres al een account heeft", async () => {
    const db = makeDb();
    const signUp = vi.fn().mockResolvedValue({ userId: "fake", isNew: false, hasSession: false, error: null });
    await expect(createEmployeeAccount(base, { signUp, db })).rejects.toThrow("Er bestaat al een account met dit e-mailadres.");
    expect(db.linkProfile).not.toHaveBeenCalled();
    expect(db.insertProfile).not.toHaveBeenCalled();
  });
});
