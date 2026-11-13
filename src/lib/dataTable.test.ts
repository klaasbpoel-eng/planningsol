import { describe, expect, it } from "vitest";
import { buildColumnFilters, buildSearchFilter, deriveColumns, findTimestampColumn, formatCellValue, groupRowsByTimestamp, humanizeColumnName, quoteColumnName, rowsToCsv, timestampGroupParity } from "./dataTable";

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

describe("quoteColumnName", () => {
  it("haalt gewone kolomnamen ongemoeid en omringt namen met spaties", () => {
    expect(quoteColumnName("dt_dn")).toBe("dt_dn");
    expect(quoteColumnName("Tx dn series Nr")).toBe('"Tx dn series Nr"');
  });
});

describe("buildColumnFilters", () => {
  const cols = deriveColumns([{ Code: "A1", Aantal: 5, Datum: "2026-11-13", Actief: true }]);
  const col = (key: string) => cols.find((c) => c.key === key);

  it("zoekt in een tekstkolom op 'bevat'", () => {
    expect(buildColumnFilters(col("Code"), "a1")).toEqual([{ key: "Code", op: "ilike", value: "*a1*" }]);
  });

  it("kent getalvergelijkingen toe", () => {
    expect(buildColumnFilters(col("Aantal"), "5")).toEqual([{ key: "Aantal", op: "eq", value: 5 }]);
    expect(buildColumnFilters(col("Aantal"), ">10")).toEqual([{ key: "Aantal", op: "gt", value: 10 }]);
    expect(buildColumnFilters(col("Aantal"), "<=2,5")).toEqual([{ key: "Aantal", op: "lte", value: 2.5 }]);
    expect(buildColumnFilters(col("Aantal"), "1.234,5")).toEqual([{ key: "Aantal", op: "eq", value: 1234.5 }]);
    expect(buildColumnFilters(col("Aantal"), "veel")).toEqual([]);
  });

  it("maakt van een dag het bereik van die dag", () => {
    const dag = [
      { key: "Datum", op: "gte", value: "2026-11-03" },
      { key: "Datum", op: "lt", value: "2026-11-04" },
    ];
    expect(buildColumnFilters(col("Datum"), "03-11-2026")).toEqual(dag);
    expect(buildColumnFilters(col("Datum"), "2026-11-03 10:45")).toEqual(dag);
  });

  it("kent een maand en een jaar toe", () => {
    expect(buildColumnFilters(col("Datum"), "11-2026")).toEqual([
      { key: "Datum", op: "gte", value: "2026-11-01" },
      { key: "Datum", op: "lt", value: "2026-12-01" },
    ]);
    expect(buildColumnFilters(col("Datum"), "2026")).toEqual([
      { key: "Datum", op: "gte", value: "2026-01-01" },
      { key: "Datum", op: "lt", value: "2027-01-01" },
    ]);
  });

  it("wijst onbestaande datums af", () => {
    expect(buildColumnFilters(col("Datum"), "31-02-2026")).toEqual([]);
    expect(buildColumnFilters(col("Datum"), "13-13-2026")).toEqual([]);
    expect(buildColumnFilters(col("Datum"), "vorige week")).toEqual([]);
  });

  it("begrijpt ja en nee", () => {
    expect(buildColumnFilters(col("Actief"), "ja")).toEqual([{ key: "Actief", op: "eq", value: true }]);
    expect(buildColumnFilters(col("Actief"), "Nee")).toEqual([{ key: "Actief", op: "eq", value: false }]);
    expect(buildColumnFilters(col("Actief"), "misschien")).toEqual([]);
  });

  it("geeft niets terug zonder kolom of zonder waarde", () => {
    expect(buildColumnFilters(undefined, "x")).toEqual([]);
    expect(buildColumnFilters(col("Code"), "   ")).toEqual([]);
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

describe("groupRowsByTimestamp", () => {
  it("maakt van opeenvolgende gelijke tijden één groep", () => {
    const rows = [
      { ts: "2026-11-02T11:05:00" },
      { ts: "2026-11-02T11:05:00" },
      { ts: "2026-11-02T14:38:00" },
      { ts: "2026-11-03T10:45:00" },
      { ts: "2026-11-03T10:45:00" },
    ];
    expect(groupRowsByTimestamp(rows, "ts").map((g) => [g.label, g.indexes])).toEqual([
      ["2026-11-02T11:05:00", [0, 1]],
      ["2026-11-02T14:38:00", [2]],
      ["2026-11-03T10:45:00", [3, 4]],
    ]);
  });
  it("wisselt de kleur per groep en houdt die bij herhiling", () => {
    const rows = [{ ts: "a" }, { ts: "b" }, { ts: "a" }];
    expect(groupRowsByTimestamp(rows, "ts").map((g) => [g.label, g.parity, g.indexes])).toEqual([
      ["a", 0, [0]],
      ["b", 1, [1]],
      ["a", 0, [2]],
    ]);
  });
  it("groepeert op de weergave tot op de minuut", () => {
    const rows = [
      { ts: "2026-11-03T10:45:02" },
      { ts: "2026-11-03T10:45:41" },
      { ts: "2026-11-03T11:51:00" },
    ];
    const groups = groupRowsByTimestamp(rows, "ts", (v) => formatCellValue(v, "date"));
    expect(groups.map((g) => [g.label, g.indexes])).toEqual([
      ["03-11-2026, 10:45", [0, 1]],
      ["03-11-2026, 11:51", [2]],
    ]);
  });
  it("geeft regels zonder tijdstip één groep zonder kleur", () => {
    const groups = groupRowsByTimestamp([{ ts: null }, { ts: "" }, { ts: "a" }], "ts");
    expect(groups.map((g) => [g.empty, g.label, g.parity, g.indexes])).toEqual([
      [true, "", null, [0, 1]],
      [false, "a", 0, [2]],
    ]);
  });
});
