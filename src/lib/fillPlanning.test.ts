import { describe, it, expect } from "vitest";
import {
  computeFillPlan,
  computeMedian,
  filterFillPlan,
  type FillPlanProductInput,
} from "./fillPlanning";

const BASE_TODAY = new Date(2026, 10, 20); // Friday 20 Nov 2026

function makeInput(overrides: Partial<FillPlanProductInput> = {}): FillPlanProductInput {
  return {
    key: "Zuurstof 3.5__Cylinders__Emmen__50",
    product: "Zuurstof 3.5 in Cilinders",
    packageType: "Cylinders",
    location: "Emmen",
    capacityPerUnit: 50,
    isBundle: false,
    packSize: 1,
    startStock: 10,
    weekdayTotals12w: [120, 0, 120, 0, 120], // 10/day on Mon, Wed, Fri
    customerSchedules: [
      {
        customerName: "Klant A",
        lastDeliveryDate: new Date(2026, 10, 13), // 7 days ago -> due today (Fri 20 Nov)
        medianInterval: 7,
        avgAmount: 20,
        deliveryCount: 5,
      },
    ],
    ...overrides,
  };
}

describe("fillPlanning calculation engine", () => {
  it("computes median robustly against outlier intervals", () => {
    expect(computeMedian([7, 7, 7, 180])).toBe(7);
    expect(computeMedian([7, 14, 21])).toBe(14);
  });

  it("supports configurable safetyBuffer in units and percent", () => {
    const input = makeInput({ startStock: 10 });

    const noBuffer = computeFillPlan([input], {
      horizonDays: 5,
      safetyBuffer: 0,
      safetyBufferMode: "units",
      method: "customer_interval",
      today: BASE_TODAY,
    });
    // Day 0 demand = 20, startStock = 10 -> fill = 10
    expect(noBuffer.fillPlanByDay[0].items[0].suggestedFill).toBe(10);

    const unitBuffer = computeFillPlan([input], {
      horizonDays: 5,
      safetyBuffer: 5,
      safetyBufferMode: "units",
      method: "customer_interval",
      today: BASE_TODAY,
    });
    // Day 0 demand = 20, startStock = 10, safetyTarget = 5 -> fill = 15
    expect(unitBuffer.fillPlanByDay[0].items[0].suggestedFill).toBe(15);

    const pctBuffer = computeFillPlan([input], {
      horizonDays: 5,
      safetyBuffer: 25,
      safetyBufferMode: "percent",
      method: "customer_interval",
      today: BASE_TODAY,
    });
    // Day 0 demand = 20, 25% buffer = 5 -> fill = 15
    expect(pctBuffer.fillPlanByDay[0].items[0].suggestedFill).toBe(15);
  });

  it("supports 5 and 10 workday horizons skipping weekends", () => {
    const input = makeInput({ startStock: 0 });
    const plan10 = computeFillPlan([input], {
      horizonDays: 10,
      safetyBuffer: 0,
      safetyBufferMode: "units",
      method: "weekday_avg",
      today: BASE_TODAY,
    });

    expect(plan10.fillPlanByDay).toHaveLength(10);
    // Day 0 = Fri 20 Nov, Day 1 = Mon 23 Nov (skips Sat 21 & Sun 22)
    expect(plan10.fillPlanByDay[0].date).toBe("2026-11-20");
    expect(plan10.fillPlanByDay[1].date).toBe("2026-11-23");
  });

  it("always preserves actual currentStock on every day tab", () => {
    const input = makeInput({
      startStock: 12,
      weekdayTotals12w: [240, 240, 240, 240, 240], // 20/day every weekday
      customerSchedules: [],
    });
    const plan = computeFillPlan([input], {
      horizonDays: 5,
      safetyBuffer: 0,
      safetyBufferMode: "units",
      method: "weekday_avg",
      today: BASE_TODAY,
    });
    // Day 0 fills +8 (20 - 12), Day 1 fills +20, but currentStock stays 12 on BOTH days
    expect(plan.fillPlanByDay[0].items[0].currentStock).toBe(12);
    expect(plan.fillPlanByDay[1].items[0].currentStock).toBe(12);
    expect(plan.fillPlanByDay[1].items[0].suggestedFill).toBe(20);
  });

  it("captures sporadic demand via weekday_avg and hybrid methods", () => {
    const sporadicProduct = makeInput({
      product: "Argon 5.0",
      startStock: 0,
      customerSchedules: [], // no regular repeat customer
      weekdayTotals12w: [60, 0, 60, 0, 120], // 10 on Fri, 5 on Mon & Wed
    });

    const intervalOnly = computeFillPlan([sporadicProduct], {
      horizonDays: 5,
      safetyBuffer: 0,
      safetyBufferMode: "units",
      method: "customer_interval",
      today: BASE_TODAY,
    });
    expect(intervalOnly.fillPlan).toHaveLength(0);

    const hybrid = computeFillPlan([sporadicProduct], {
      horizonDays: 5,
      safetyBuffer: 0,
      safetyBufferMode: "units",
      method: "hybrid",
      today: BASE_TODAY,
    });
    expect(hybrid.fillPlan).toHaveLength(1);
    expect(hybrid.fillPlanByDay[0].items[0].expectedDemand).toBe(10);
    expect(hybrid.fillPlanByDay[0].items[0].suggestedFill).toBe(10);
  });

  it("recalculates per-day totals when filtering by location and package type", () => {
    const emmenBundle = makeInput({
      key: "O2__Emmen__50__true",
      product: "Zuurstof 3.5 in Bundles",
      location: "Emmen",
      isBundle: true,
      packSize: 16,
      startStock: 0,
    });
    const tilburgCyl = makeInput({
      key: "N2__Tilburg__50__false",
      product: "Stikstof 4.8 in Cilinders",
      location: "Tilburg",
      isBundle: false,
      packSize: 1,
      startStock: 0,
      customerSchedules: [
        {
          customerName: "Klant B",
          lastDeliveryDate: new Date(2026, 10, 13),
          medianInterval: 7,
          avgAmount: 10,
          deliveryCount: 4,
        },
      ],
    });

    const base = computeFillPlan([emmenBundle, tilburgCyl], {
      horizonDays: 5,
      safetyBuffer: 0,
      safetyBufferMode: "units",
      method: "customer_interval",
      today: BASE_TODAY,
    });

    // Unfiltered day 0 total = 20 + 10 = 30
    expect(base.fillPlanByDay[0].totalSuggestedFill).toBe(30);

    // Filtered to Emmen: day 0 total must be 20 (NOT 30!)
    const emmenOnly = filterFillPlan(base.fillPlan, base.fillPlanByDay, {
      location: "Emmen",
      search: "",
      packageFilter: "Alle",
    });
    expect(emmenOnly.fillPlanByDay[0].items).toHaveLength(1);
    expect(emmenOnly.fillPlanByDay[0].totalSuggestedFill).toBe(20);

    // Filtered to Cilinders: only Tilburg cylinder remains
    const cylOnly = filterFillPlan(base.fillPlan, base.fillPlanByDay, {
      location: "Alle",
      search: "",
      packageFilter: "Cilinders",
    });
    expect(cylOnly.fillPlanByDay[0].items).toHaveLength(1);
    expect(cylOnly.fillPlanByDay[0].totalSuggestedFill).toBe(10);
  });
});
