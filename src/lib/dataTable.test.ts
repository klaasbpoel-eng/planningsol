import { describe, expect, it } from "vitest";
import { buildSearchFilter, deriveColumns, findTimestampColumn, formatCellValue, groupRowsByTimestamp, humanizeColumnName, rowsToCsv, timestampGroupParity } from "./dataTable";

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

describe("findTimestampColumn", () => {
  it("kiest dt_dn boven andere kolommen", () => {
    const cols = deriveColumns([{ Datum: "2026-11-13", dt_dn: "2026-11-13T08:00:00", Timestamp: "2026-11-13T08:00:00" }]);
    expect(findTimestampColumn(cols)).toBe("dt_dn");
  });
  it("kiest een kolom met timestamp in de naam", () => {
    const cols = deriveColumns([{ Datum: "2026-11-13", Timestamp: "2026-11-13T08:00:00" }]);
    expect(findTimestampColumn(cols)).toBe("Timestamp");
  });
  it("valt terug op de eerste datumkolom", () => {
    const cols = deriveColumns([{ Code: "A1", CorrectieDatum: "2026-11-13 08:00:00" }]);
    expect(findTimestampColumn(cols)).toBe("CorrectieDatum");
  });
  it("geeft null zonder datumkolom", () => {
    expect(findTimestampColumn(deriveColumns([{ Code: "A1" }]))).toBeNull();
  });
});

describe("timestampGroupParity", () => {
  it("geeft dezelfde timestamp dezelfde kleur en wisselt per groep", () => {
    const rows = [
      { ts: "2026-11-13T08:00:00" },
      { ts: "2026-11-13T08:00:00" },
      { ts: "2026-11-13T09:15:00" },
      { ts: "2026-11-13T10:30:00" },
      { ts: "2026-11-13T10:30:00" },
    ];
    expect(timestampGroupParity(rows, "ts")).toEqual([0, 0, 1, 0, 0]);
  });
  it("behoudt de kleur als gelijke timestamps door sortering verspreid staan", () => {
    const rows = [{ ts: "a" }, { ts: "b" }, { ts: "a" }];
    expect(timestampGroupParity(rows, "ts")).toEqual([0, 1, 0]);
  });
  it("geeft lege waarden geen groepskleur", () => {
    expect(timestampGroupParity([{ ts: null }, { ts: "" }, { ts: "a" }], "ts")).toEqual([null, null, 0]);
  });

  it("groups rows that show the same minute even when seconds differ", () => {
    const rows = [
      { ts: "2026-11-03T10:45:02" },
      { ts: "2026-11-03T10:45:41" },
      { ts: "2026-11-03T11:51:00" },
    ];
    expect(timestampGroupParity(rows, "ts", (v) => formatCellValue(v, "date"))).toEqual([0, 0, 1]);
  });
});
