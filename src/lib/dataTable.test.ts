import { describe, expect, it } from "vitest";
import { buildSearchFilter, deriveColumns, findTimestampColumn, formatCellValue, humanizeColumnName, rowsToCsv, timestampGroupParity } from "./dataTable";

describe("humanizeColumnName", () => {
  it("maakt leesbare kolomnamen", () => {
    expect(humanizeColumnName("ArtikelCode")).toBe("Artikel code");
    expect(humanizeColumnName("correctie_datum")).toBe("Correctie datum");
  });
});

describe("deriveColumns", () => {
  it("herkent soorten kolommen en verbergt id", () => {
    const cols = deriveColumns([{ id: 1, Aantal: 5, Datum: "2026-11-13", Actief: true, Omschrijving: "Fles" }]);
    expect(cols.map((c) => [c.key, c.kind])).toEqual([
      ["Aantal", "number"],
      ["Datum", "date"],
      ["Actief", "boolean"],
      ["Omschrijving", "text"],
    ]);
  });
});

describe("formatCellValue", () => {
  it("gebruikt punt voor duizendtallen en komma voor decimalen", () => {
    expect(formatCellValue(1234.5, "number")).toBe("1.234,5");
  });
  it("toont datums als dd-mm-jjjj", () => {
    expect(formatCellValue("2026-11-13", "date")).toBe("13-11-2026");
  });
  it("toont lege waarden als streepje", () => {
    expect(formatCellValue(null, "text")).toBe("—");
  });
});

describe("buildSearchFilter", () => {
  it("zoekt alleen in tekstkolommen", () => {
    const cols = deriveColumns([{ Aantal: 1, Code: "A1" }]);
    expect(buildSearchFilter(cols, "fles")).toBe("Code.ilike.*fles*");
    expect(buildSearchFilter(cols, "  ")).toBeNull();
  });
});

describe("rowsToCsv", () => {
  it("gebruikt puntkomma en decimale komma", () => {
    const cols = deriveColumns([{ Code: "A;1", Aantal: 2.5 }]);
    expect(rowsToCsv(cols, [{ Code: "A;1", Aantal: 2.5 }])).toBe('Code;Aantal\r\n"A;1";2,5');
  });
});
