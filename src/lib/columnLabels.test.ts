import { describe, expect, it } from "vitest";
import {
  applyColumnLabels,
  buildColumnLabelMap,
  columnLabelDrafts,
  columnLabelsKey,
  parseColumnLabels,
} from "./columnLabels";
import { deriveColumns } from "./dataTable";

const ROWS = [{ id: 1, dt_dn: "2026-11-03T10:45:02", code: "A1" }];
const BASE = deriveColumns(ROWS);

describe("kolomnamen opslaan en toepassen", () => {
  it("maakt één Sleutel per tabel aan", () => {
    expect(columnLabelsKey("RamsesCorrecties")).toBe("column_labels_RamsesCorrecties");
  });

  it("leest opgeslagen namen terug", () => {
    expect(parseColumnLabels('{"dt_dn":"Tijdstip","code":"Code"}')).toEqual({ dt_dn: "Tijdstip", code: "Code" });
  });

  it("negeert lege, onbruikbare en kapotte opslag", () => {
    expect(parseColumnLabels(null)).toEqual({});
    expect(parseColumnLabels(undefined)).toEqual({});
    expect(parseColumnLabels("")).toEqual({});
    expect(parseColumnLabels("geen json")).toEqual({});
    expect(parseColumnLabels('["dt_dn"]')).toEqual({});
    expect(parseColumnLabels('{"dt_dn":"   ","code":"Code"}')).toEqual({ code: "Code" });
  });

  it("past namen toe en laat kolommen zonder naam onveranderd", () => {
    const applied = applyColumnLabels(BASE, { dt_dn: "Tijdstip" });
    expect(applied.map((c) => c.label)).toEqual(["Dt dn".replace("Dt dn", "Dt dn"), "Code"].map((l, i) => (i === 0 ? "Tijdstip" : l)));
    expect(applied[1].label).toBe("Code");
    // the original column objects are not modified
    expect(BASE[0].label).toBe("Dt dn");
  });

  it("starts the form from the currently shown names", () => {
    const applied = applyColumnLabels(BASE, { dt_dn: "Tijdstip" });
    expect(columnLabelDrafts(applied)).toEqual({ dt_dn: "Tijdstip", code: "Code" });
  });

  it("slaat alleen afwijkende namen op en laat lege vallen", () => {
    const map = buildColumnLabelMap(BASE, { dt_dn: "Tijdstip", code: "  " });
    expect(map).toEqual({ dt_dn: "Tijdstip" });
  });

  it("verwijdert een naam die teruggezet wordt op de automatische", () => {
    const map = buildColumnLabelMap(BASE, { dt_dn: "Dt dn", code: "Artikel" });
    expect(map).toEqual({ code: "Artikel" });
  });
});
