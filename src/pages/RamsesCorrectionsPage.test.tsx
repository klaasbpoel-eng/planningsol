import "@/test/access/browserStubs";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { getPermissionsForRole } from "@/hooks/useUserPermissions";
import type { ProtectedRouteChildProps } from "@/components/auth/ProtectedRoute";

// Two rows on one day and one row on the next day: the day is the group, the time of day is not shown.
const ROWS = vi.hoisted(() => [
  { id: 1, dt_dn: "2026-11-03T10:45:02", code: "A1" },
  { id: 2, dt_dn: "2026-11-03T11:51:00", code: "A2" },
  { id: 3, dt_dn: "2026-11-04T09:15:00", code: "A3" },
]);

// Column filters the page sends to the database, recorded so tests can read them back.
const FILTER_CALLS = vi.hoisted(() => [] as string[][]);

// Stored column names, as they live in the backend settings table.
const SETTINGS = vi.hoisted(() => ({
  stored: '{"dt_dn":"Tijdstip"}',
  getByKey: vi.fn(async () => ({ value: SETTINGS.stored, description: null })),
  upsert: vi.fn(async (_key: string, value: string, _description?: string) => ({
    key: "column_labels_RamsesCorrecties",
    value,
  })),
}));

const AI = vi.hoisted(() => ({
  requestFilterPlan: vi.fn(async (_input: { question: string }) => ({
    filters: [{ column: "code", operator: "contains", value: "a1", values: [] }],
    explanation: "Regels waarvan de code a1 bevat.",
  })),
}));
vi.mock("@/lib/aiFilterClient", () => ({ requestFilterPlan: AI.requestFilterPlan }));

vi.mock("@/lib/api", () => ({ api: { appSettings: { getByKey: SETTINGS.getByKey, upsert: SETTINGS.upsert } } }));

vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: (props: ProtectedRouteChildProps) => ReactNode }) =>
    children({
      user: { id: "u1", email: "test@sol.nl" } as ProtectedRouteChildProps["user"],
      role: "admin",
      isAdmin: true,
      permissions: getPermissionsForRole("admin"),
      productionLocation: null,
      canViewAllLocations: true,
    }),
}));

// Sort calls the page sends to the database, recorded so tests can read them back.
const ORDER_CALLS = vi.hoisted(() => [] as string[][]);

vi.mock("@/integrations/supabase/client", () => {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "or"]) query[method] = () => query;
  query.order = (column: string, options: { ascending?: boolean }) => {
    ORDER_CALLS.push([column, String(options?.ascending)]);
    return query;
  };
  query.filter = (column: string, op: string, value: unknown) => {
    FILTER_CALLS.push([column, op, String(value)]);
    return query;
  };
  query.range = (_from: number, to: number) =>
    Promise.resolve({ data: ROWS.slice(0, to + 1), error: null, count: ROWS.length });
  return { supabase: { from: () => query, auth: { signOut: vi.fn() } } };
});

vi.mock("@/components/layout/PageLayout", () => ({
  PageLayout: ({ title, children }: { title?: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import RamsesCorrectionsPage from "./RamsesCorrectionsPage";

const groupHeader = (time: string) => screen.getByRole("button", { name: new RegExp(time) });

async function openPage() {
  render(<RamsesCorrectionsPage />);
  await waitFor(() => expect(screen.getByText("A3")).toBeInTheDocument());
}

const columnNameInput = (key: string) => document.getElementById(`kolomnaam-${key}`) as HTMLInputElement;

describe("tijdgroepen op de Ramses-correctiespagina", () => {
  it("toont per tijdgroep een kop met het aantal regels", async () => {
    await openPage();
    expect(screen.getByRole("button", { name: "Klap tijdgroep 03-11-2026" })).toBeInTheDocument();
    expect(screen.getByText("2 regels")).toBeInTheDocument();
    expect(screen.getByText("1 regel")).toBeInTheDocument();
    expect(screen.getByText("2 tijdgroepen op deze pagina")).toBeInTheDocument();
  });

  it("toont in de groepskop alleen de dag, niet de tijd", async () => {
    await openPage();
    expect(screen.getByRole("button", { name: "Klap tijdgroep 03-11-2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Klap tijdgroep 04-11-2026" })).toBeInTheDocument();
    expect(screen.queryByText(/10:45|11:51|09:15/)).not.toBeInTheDocument();
  });

  it("klapt een tijdgroep in en weer uit", async () => {
    await openPage();
    const header = groupHeader("03-11-2026");
    expect(header).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(header);
    expect(screen.queryByText("A1")).not.toBeInTheDocument();
    expect(screen.queryByText("A2")).not.toBeInTheDocument();
    expect(screen.getByText("A3")).toBeInTheDocument();
    expect(header).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(header);
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(header).toHaveAttribute("aria-expanded", "true");
  });

  it("sluit en opent alle groepen tegelijk", async () => {
    await openPage();
    fireEvent.click(screen.getByRole("button", { name: "Alles sluiten" }));
    expect(screen.queryByText("A1")).not.toBeInTheDocument();
    expect(screen.queryByText("A3")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Alles openen" }));
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("A3")).toBeInTheDocument();
  });

  it("laat de datumkolom weg in de tabel, maar houdt de tijdgroepen", async () => {
    await openPage();
    // The grouping column is no longer a column of its own...
    expect(screen.queryByRole("button", { name: /Sorteer op (Tijdstip|Dt dn)/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sorteer op Code" })).toBeInTheDocument();
    for (const code of ["A1", "A2", "A3"]) {
      const row = screen.getByText(code).closest("tr") as HTMLTableRowElement;
      expect(row.querySelectorAll("td")).toHaveLength(1);
    }
    // ...but the date is still there, in the header of each time group.
    expect(screen.getByRole("button", { name: "Klap tijdgroep 03-11-2026" })).toBeInTheDocument();
    expect(screen.getByText("2 regels")).toBeInTheDocument();
  });

  it("sorteert op datum via de knop bij de tijdgroepen", async () => {
    await openPage();
    expect(screen.getByText("Nieuwste eerst")).toBeInTheDocument();

    ORDER_CALLS.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "Sorteer op datum" }));
    await waitFor(() => expect(ORDER_CALLS).toContainEqual(["dt_dn", "false"]));

    fireEvent.click(screen.getByRole("button", { name: "Sorteer op datum" }));
    await waitFor(() => expect(ORDER_CALLS).toContainEqual(["dt_dn", "true"]));
    expect(screen.getByText("Oudste eerst")).toBeInTheDocument();
  });

  it("geeft regels en tijdgroepskoppen geen kleurverschil", async () => {
    await openPage();
    const rows = ["A1", "A2", "A3"].map(
      (code) => screen.getByText(code).closest("tr") as HTMLTableRowElement,
    );
    const headers = ["03-11-2026", "04-11-2026"].map(
      (time) => groupHeader(time).closest("tr") as HTMLTableRowElement,
    );
    expect(rows).toHaveLength(3);
    expect(headers).toHaveLength(2);
    for (const el of [...rows, ...headers]) {
      expect(el.className).not.toMatch(/bg-(primary|accent)/);
      expect(el.className).not.toMatch(/border-l-(primary|accent)/);
    }
  });
});

describe("kolomnamen op de Ramses-correctiespagina", () => {
  it("gebruikt de opgeslagen kolomnamen bij het filteren", async () => {
    await openPage();
    fireEvent.click(screen.getByRole("combobox", { name: /Kolom kiezen om op te filteren/ }));
    expect(await screen.findByRole("option", { name: "Tijdstip" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Dt dn" })).not.toBeInTheDocument();
  });

  it("leest een kolomnaam uit de backend en slaat een nieuwe naam daar op", async () => {
    await openPage();
    fireEvent.click(screen.getByRole("button", { name: "Kolomnamen" }));

    const input = columnNameInput("dt_dn");
    expect(input.value).toBe("Tijdstip");

    fireEvent.change(input, { target: { value: "Datumcorrectie" } });
    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(SETTINGS.upsert).toHaveBeenCalled());
    const [key, value, description] = SETTINGS.upsert.mock.calls.at(-1);
    expect(key).toBe("column_labels_RamsesCorrecties");
    expect(JSON.parse(value)).toEqual({ dt_dn: "Datumcorrectie" });
    expect(description).toContain("RamsesCorrecties");
    fireEvent.click(screen.getByRole("combobox", { name: /Kolom kiezen om op te filteren/ }));
    expect(await screen.findByRole("option", { name: "Datumcorrectie" })).toBeInTheDocument();
  });

  it("zet alle kolomnamen terug naar de automatische namen", async () => {
    await openPage();
    fireEvent.click(screen.getByRole("button", { name: "Kolomnamen" }));
    fireEvent.click(screen.getByRole("button", { name: "Automatische namen herstellen" }));

    await waitFor(() => expect(SETTINGS.upsert).toHaveBeenCalledWith("column_labels_RamsesCorrecties", "{}", expect.any(String)));
    fireEvent.click(screen.getByRole("button", { name: "Sluiten" }));
    fireEvent.click(screen.getByRole("combobox", { name: /Kolom kiezen om op te filteren/ }));
    expect(await screen.findByRole("option", { name: "Dt dn" })).toBeInTheDocument();
  });
});

describe("filteren op kolom op de Ramses-correctiespagina", () => {
  const kiesKolom = async (label: string) => {
    fireEvent.click(screen.getByRole("combobox", { name: /Kolom kiezen om op te filteren/ }));
    fireEvent.click(await screen.findByRole("option", { name: label }));
  };

  it("vraagt alleen regels op van de gekozen kolom met de ingetypte waarde", async () => {
    await openPage();
    // Nothing to filter on until a column is picked.
    expect(screen.getByLabelText("Filterwaarde")).toBeDisabled();

    FILTER_CALLS.length = 0;
    await kiesKolom("Code");
    fireEvent.change(screen.getByLabelText("Filterwaarde"), { target: { value: "a1" } });

    await waitFor(() => expect(FILTER_CALLS).toContainEqual(["code", "ilike", "*a1*"]), { timeout: 3000 });
  });

  it("wist de filterkeuze weer", async () => {
    await openPage();
    await kiesKolom("Code");
    fireEvent.change(screen.getByLabelText("Filterwaarde"), { target: { value: "a1" } });
    await waitFor(() => expect(FILTER_CALLS).toContainEqual(["code", "ilike", "*a1*"]), { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: "Filter wissen" }));
    expect((screen.getByLabelText("Filterwaarde") as HTMLInputElement).value).toBe("");
    // Back to no column picked, so the value box is out of use again.
    expect(screen.getByLabelText("Filterwaarde")).toBeDisabled();
  });

  it("vraagt alleen de aangevinkte waarden op", async () => {
    await openPage();
    await kiesKolom("Code");
    // Let the column list finish closing first; it hands focus back to its own button.
    await new Promise((resolve) => setTimeout(resolve, 50));
    fireEvent.click(screen.getByRole("button", { name: "Waarden kiezen" }));

    FILTER_CALLS.length = 0;
    fireEvent.click(await screen.findByRole("option", { name: /A1/ }));
    fireEvent.click(screen.getByRole("option", { name: /A3/ }));

    await waitFor(() => expect(FILTER_CALLS).toContainEqual(["code", "in", '("A1","A3")']));

    expect(screen.getByRole("button", { name: "2 waarden gekozen" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Vinkjes wissen" }));
    expect(screen.getByRole("button", { name: "Waarden kiezen" })).toBeInTheDocument();
  });
});

describe("zoeken in gewone taal op de Ramses-correctiespagina", () => {
  it("zet de vraag om in filters die je los weer weghaalt", async () => {
    await openPage();
    FILTER_CALLS.length = 0;
    fireEvent.change(screen.getByLabelText("Zoeken in gewone taal"), { target: { value: "alles met code a1" } });
    fireEvent.click(screen.getByRole("button", { name: "Filters maken" }));

    expect(await screen.findByText('Code bevat "a1"')).toBeInTheDocument();
    expect(screen.getByText("Regels waarvan de code a1 bevat.")).toBeInTheDocument();
    expect(AI.requestFilterPlan.mock.calls[0][0]).toMatchObject({ question: "alles met code a1" });
    await waitFor(() => expect(FILTER_CALLS).toContainEqual(["code", "ilike", "*a1*"]));

    FILTER_CALLS.length = 0;
    fireEvent.click(screen.getByRole("button", { name: 'Filter weghalen: Code bevat "a1"' }));
    expect(screen.queryByText('Code bevat "a1"')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("A3")).toBeInTheDocument());
    expect(FILTER_CALLS).not.toContainEqual(["code", "ilike", "*a1*"]);
  });

  it("toont de foutmelding als de AI niet kan helpen", async () => {
    AI.requestFilterPlan.mockRejectedValueOnce(new Error("Het AI-tegoed is op."));
    await openPage();
    fireEvent.change(screen.getByLabelText("Zoeken in gewone taal"), { target: { value: "iets" } });
    fireEvent.click(screen.getByRole("button", { name: "Filters maken" }));
    expect(await screen.findByText("Het AI-tegoed is op.")).toBeInTheDocument();
  });
});
