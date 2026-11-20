import { describe, it, expect } from "vitest";
import {
  computeFillPlan,
  computeMedian,
  computeWinsorizedEwma,
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
    displayCapacityLiters: 50,
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

  it("dampens one-off extreme spikes and weights recent weeks higher in EWMA", () => {
    // 11 normal weeks of 10, plus 1 extreme spike of 200 six weeks ago
    const withSpike = [10, 10, 10, 10, 10, 10, 200, 10, 10, 10, 10, 10];
    const ewma = computeWinsorizedEwma(withSpike);
    // Plain average would be 25.8, winsorized EWMA caps the spike at 25 -> ~11.1
    expect(ewma).toBeGreaterThan(9.5);
    expect(ewma).toBeLessThan(13);

    // Recent growth: last 4 weeks = 20, older 8 weeks = 5 -> EWMA > plain avg (10)
    const growing = [20, 20, 20, 20, 5, 5, 5, 5, 5, 5, 5, 5];
    expect(computeWinsorizedEwma(growing)).toBeGreaterThan(12);
  });

  it("applies YoY seasonalFactor in ewma_seasonal method", () => {
    const input = makeInput({
      startStock: 0,
      weekdayBuckets12w: [
        [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      ],
      seasonalFactor: 1.2,
    });

    const plan = computeFillPlan([input], {
      horizonDays: 5,
      safetyBuffer: 0,
      safetyBufferMode: "units",
      method: "ewma_seasonal",
      today: BASE_TODAY,
    });
    // Friday demand = 10 * 1.2 = 12
    expect(plan.fillPlanByDay[0].items[0].expectedDemand).toBe(12);
    expect(plan.fillPlanByDay[0].items[0].suggestedFill).toBe(12);
  });

  it("supports configurable safetyBuffer in units, percent, and service_level", () => {
    const input = makeInput({
      startStock: 10,
      weekdayBuckets12w: [
        [20, 10, 30, 10, 20, 10, 30, 10, 20, 10, 30, 10],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [20, 10, 30, 10, 20, 10, 30, 10, 20, 10, 30, 10],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [20, 10, 30, 10, 20, 10, 30, 10, 20, 10, 30, 10],
      ],
    });

    const noBuffer = computeFillPlan([input], {
      horizonDays: 5,
      safetyBuffer: 0,
      safetyBufferMode: "units",
      method: "customer_interval",
      today: BASE_TODAY,
    });
    expect(noBuffer.fillPlanByDay[0].items[0].suggestedFill).toBe(10);

    const unitBuffer = computeFillPlan([input], {
      horizonDays: 5,
      safetyBuffer: 5,
      safetyBufferMode: "units",
      method: "customer_interval",
      today: BASE_TODAY,
    });
    expect(unitBuffer.fillPlanByDay[0].items[0].suggestedFill).toBe(15);

    const pctBuffer = computeFillPlan([input], {
      horizonDays: 5,
      safetyBuffer: 25,
      safetyBufferMode: "percent",
      method: "customer_interval",
      today: BASE_TODAY,
    });
    expect(pctBuffer.fillPlanByDay[0].items[0].suggestedFill).toBe(15);

    const slBuffer = computeFillPlan([input], {
      horizonDays: 5,
      safetyBuffer: 95,
      safetyBufferMode: "service_level",
      method: "customer_interval",
      today: BASE_TODAY,
    });
    // 95% service level adds z=1.65 * sigma > 0
    expect(slBuffer.fillPlanByDay[0].items[0].safetyTarget).toBeGreaterThan(0);
    expect(slBuffer.fillPlanByDay[0].items[0].suggestedFill).toBeGreaterThan(10);
  });

  it("displays bundle capacity as 800 L", () => {
    const bundle = makeInput({
      product: "Stikstof 4.8 in Bundles",
      packageType: "Bundles",
      capacityPerUnit: 50,
      displayCapacityLiters: 800,
      isBundle: true,
      packSize: 16,
      startStock: 0,
    });
    const plan = computeFillPlan([bundle], {
      horizonDays: 5,
      safetyBuffer: 0,
      safetyBufferMode: "units",
      method: "customer_interval",
      today: BASE_TODAY,
    });
    expect(plan.fillPlan[0].displayCapacityLiters).toBe(800);
    expect(plan.fillPlanByDay[0].items[0].displayCapacityLiters).toBe(800);
  });

  it("always preserves actual currentStock on every day tab", () => {
    const input = makeInput({
      startStock: 12,
      weekdayTotals12w: [240, 240, 240, 240, 240],
      customerSchedules: [],
    });
    const plan = computeFillPlan([input], {
      horizonDays: 5,
      safetyBuffer: 0,
      safetyBufferMode: "units",
      method: "weekday_avg",
      today: BASE_TODAY,
    });
    expect(plan.fillPlanByDay[0].items[0].currentStock).toBe(12);
    expect(plan.fillPlanByDay[1].items[0].currentStock).toBe(12);
    expect(plan.fillPlanByDay[1].items[0].suggestedFill).toBe(20);
  });

  it("recalculates per-day totals when filtering and excludes discontinued product", () => {
    const oldProduct = makeInput({
      product: "Zuurstof Medicinaal Gasv. SOL in Cylinders aluminium integrated",
      packageType: "Cylinders aluminium integrated 200 Bar",
      startStock: 0,
    });
    const emmenBundle = makeInput({
      key: "O2__Bundles__Emmen__50",
      product: "Zuurstof 3.5 in Bundles",
      packageType: "Bundles",
      location: "Emmen",
      isBundle: true,
      displayCapacityLiters: 800,
      packSize: 16,
      startStock: 0,
    });
    const tilburgCyl = makeInput({
      key: "N2__Cylinders__Tilburg__50",
      product: "Stikstof 4.8 in Cilinders",
      packageType: "Cylinders",
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

    const base = computeFillPlan([oldProduct, emmenBundle, tilburgCyl], {
      horizonDays: 5,
      safetyBuffer: 0,
      safetyBufferMode: "units",
      method: "customer_interval",
      today: BASE_TODAY,
    });

    expect(base.fillPlan).toHaveLength(2);
    expect(base.fillPlanByDay[0].totalSuggestedFill).toBe(30);

    const emmenOnly = filterFillPlan(base.fillPlan, base.fillPlanByDay, {
      location: "Emmen",
      search: "",
      packageFilter: "Alle",
    });
    expect(emmenOnly.fillPlanByDay[0].totalSuggestedFill).toBe(20);
  });
});
