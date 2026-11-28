import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const day = (date: string, items: any[]) => ({
  date, dayLabel: "ma 30 nov",
  totalExpectedDemand: items.reduce((s, i) => s + i.expectedDemand, 0),
  totalSuggestedFill: items.reduce((s, i) => s + i.suggestedFill, 0), items,
});
const base = { packageType: "Cylinders", location: "Tilburg", capacityPerUnit: 50, displayCapacityLiters: 50, currentStock: 5, safetyTarget: 0 };
const cyl = { ...base, product: "Argon", isBundle: false, packSize: 1, expectedDemand: 10, projectedStockBefore: 5, suggestedFill: 5 };
const bun = { ...base, product: "Stikstof bundel", isBundle: true, packSize: 12, displayCapacityLiters: 600, expectedDemand: 2, projectedStockBefore: 0, suggestedFill: 2 };
const plan = (it: any) => ({ ...it, startStock: it.projectedStockBefore, seasonalFactor: 1, dailyStdDev: 0, totalExpectedDemand: it.expectedDemand, totalSuggestedFill: it.suggestedFill, perDay: [] });

vi.mock("@/hooks/useGasFlowPredictor", () => ({
  useGasFlowPredictor: () => ({
    isLoading: false, error: null,
    data: { fillPlanInputs: [], fillPlan: [plan(cyl), plan(bun)], fillPlanByDay: [day("2026-11-30", [cyl, bun])] },
  }),
}));

import { FillPlanning } from "./FillPlanning";

describe("FillPlanning", () => {
  it("toont cilinders en bundels apart en verklarende kolommen", () => {
    render(<FillPlanning />);
    expect(screen.getAllByText("(= 24 cilinders)")).toHaveLength(2);
    expect(screen.getByText("Gedekt door huidige voorraad")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Voorraad begin dag" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Tekort" })).toBeTruthy();
    expect(screen.getByText("600 L")).toBeTruthy();
  });
});
