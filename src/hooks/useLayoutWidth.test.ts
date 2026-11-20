import { describe, it, expect, beforeEach } from "vitest";
import { getLayoutWidth, setLayoutWidth } from "./useLayoutWidth";

describe("breedtevoorkeur", () => {
  beforeEach(() => localStorage.clear());
  it("staat standaard op normaal", () => expect(getLayoutWidth()).toBe("normal"));
  it("onthoudt volledige breedte", () => {
    setLayoutWidth("full");
    expect(getLayoutWidth()).toBe("full");
  });
});
