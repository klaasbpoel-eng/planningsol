import { describe, expect, it } from "vitest";
import { planToRules, sampleValues, type AiPlanFilter } from "./aiFilters";
import type { DataColumn } from "./dataTable";

const columns: DataColumn[] = [
  { key: "dt_dn", label: "Tijdstip", kind: "date" },
  { key: "tx_en_operator", label: "Operator", kind: "text" },
  { key: "aantal", label: "Aantal", kind: "number" },
  { key: "actief", label: "Actief", kind: "boolean" },
];

const f = (column: string, operator: AiPlanFilter["operator"], value: string | null, values: string[] = []): AiPlanFilter => ({
  column,
  operator,
  value,
  values,
});

const plan = (...filters: AiPlanFilter[]) => planToRules(columns, { filters, explanation: "" });

describe("AI-filters omzetten", () => {
  it("zoekt tekst die de naam bevat, zonder op hoofdletters te letten", () => {
    const { rules } = plan(f("tx_en_operator", "contains", "Jansen"));
    expect(rules).toEqual([
      { id: "ai-0", description: 'Operator bevat "Jansen"', filters: [{ key: "tx_en_operator", op: "ilike", value: "*Jansen*" }] },
    ]);
  });

  it("maakt van begin- en einddatum één periode tot de dag na het einde", () => {
    const { rules } = plan(f("dt_dn", "gte", "2026-10-01"), f("dt_dn", "lt", "2026-11-01"));
    expect(rules).toHaveLength(1);
    expect(rules[0].description).toBe("Tijdstip van 01-10-2026 t/m 31-10-2026");
    expect(rules[0].filters).toEqual([
      { key: "dt_dn", op: "gte", value: "2026-10-01" },
      { key: "dt_dn", op: "lt", value: "2026-11-01" },
    ]);
  });

  it("vertaalt een datum 'op' één dag naar die hele dag", () => {
    const { rules } = plan(f("dt_dn", "equals", "2026-11-03"));
    expect(rules[0].filters).toEqual([
      { key: "dt_dn", op: "gte", value: "2026-11-03" },
      { key: "dt_dn", op: "lt", value: "2026-11-04" },
    ]);
  });

  it("vraagt een lijst waarden op en vergelijkt getallen", () => {
    const { rules } = plan(f("tx_en_operator", "one_of", null, ["A, B", "C"]), f("aantal", "gt", "5"));
    expect(rules[0].filters).toEqual([{ key: "tx_en_operator", op: "in", value: '("A, B","C")' }]);
    expect(rules[1]).toMatchObject({ description: "Aantal groter dan 5", filters: [{ key: "aantal", op: "gt", value: 5 }] });
  });

  it("zet ja/nee om naar waar/onwaar", () => {
    expect(plan(f("actief", "equals", "false")).rules[0].filters).toEqual([{ key: "actief", op: "eq", value: false }]);
  });

  it("laat voorstellen weg die niet bij de kolom passen en telt ze", () => {
    const { rules, skipped } = plan(
      f("bestaat_niet", "contains", "x"),
      f("dt_dn", "gte", "2026-02-31"),
      f("aantal", "contains", "5"),
      f("tx_en_operator", "gt", "5"),
      f("tx_en_operator", "contains", "   "),
    );
    expect(rules).toEqual([]);
    expect(skipped).toBe(5);
  });

  it("geeft per tekst- en getalkolom een paar voorbeeldwaarden mee", () => {
    const rows = [{ tx_en_operator: "Jansen", aantal: 3, dt_dn: "2026-11-03" }, { tx_en_operator: "Jansen" }, { tx_en_operator: null }];
    expect(sampleValues(columns, rows, { tx_en_operator: ["De Vries"] })).toEqual({
      tx_en_operator: ["De Vries", "Jansen"],
      aantal: ["3"],
    });
  });
});
