import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildExcludedProductNames } from "./gasTypeUtils";

const getTypes = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { gasTypes: { getAllIncludingInactive: getTypes } } }));

describe("rapportagefilters", () => {
  beforeEach(() => {
    getTypes.mockResolvedValue([
      { name: "Fysiek", is_digital: false, is_external: false },
      { name: "Digitaal", is_digital: true, is_external: false },
      { name: "Extern", is_digital: false, is_external: true },
    ]);
  });
  it("sluit digitale producten uit zonder fysieke of externe producten te verbergen", async () => {
    expect(await buildExcludedProductNames(true, false)).toEqual(new Set(["Digitaal"]));
  });
  it("combineert de twee uitsluitfilters", async () => {
    expect(await buildExcludedProductNames(true, true)).toEqual(new Set(["Digitaal", "Extern"]));
  });
  it("geeft geen uitsluitingen zonder actief filter", async () => {
    expect(await buildExcludedProductNames(false, false)).toEqual(new Set());
  });
  it("presenteert een mislukte metadatalookup niet als ongefilterde cijfers", async () => {
    getTypes.mockRejectedValue(new Error("Niet beschikbaar"));
    await expect(buildExcludedProductNames(true, false)).rejects.toThrow("Niet beschikbaar");
  });
});