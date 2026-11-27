import "@/test/access/browserStubs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProductionReports } from "./ProductionReports";

const state = vi.hoisted(() => ({ chart: [] as Array<{ cylinders: number; prevCylinders: number }>, dryIce: vi.fn() }));
const rows = [
  { Datum: "2026-01-08", Locatie: "SOL Emmen", Product: "Fysiek", Aantal: 20, Capaciteit: 50 },
  { Datum: "2026-01-08", Locatie: "SOL Tilburg", Product: "Digitaal", Aantal: 100, Capaciteit: 10 },
  { Datum: "2026-01-09", Locatie: "SOL Emmen", Product: "Extern", Aantal: 50, Capaciteit: 50 },
  { Datum: "2026-01-06", Locatie: "SOL Emmen", Product: "Fysiek", Aantal: 10, Capaciteit: 50 },
];
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  const query: Record<string, unknown> = {};
  for (const key of ["eq", "order", "select"]) query[key] = () => query;
  query.range = () => Promise.resolve({ data: rows, error: null });
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ count: rows.length, error: null }).then(resolve);
  return query;
} } }));
vi.mock("@/lib/api", () => ({ api: {
  reports: { getDryIceEfficiency: state.dryIce },
  gasTypes: { getAllIncludingInactive: async () => [
    { name: "Fysiek", id: "physical", is_digital: false, is_external: false },
    { name: "Digitaal", id: "digital", is_digital: true, is_external: false },
    { name: "Extern", id: "external", is_digital: false, is_external: true },
  ] },
} }));
vi.mock("./TopCustomersWidget", () => ({ TopCustomersWidget: () => null }));
vi.mock("./ReportExportButtons", () => ({ ReportExportButtons: () => null }));
vi.mock("recharts", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => children;
  return {
    ResponsiveContainer: passthrough,
    ComposedChart: ({ data, children }: { data: Array<{ cylinders: number; prevCylinders: number }>; children?: React.ReactNode }) => { state.chart = data; return children; },
    XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
    Tooltip: () => null, Area: () => null, BarChart: passthrough, Bar: () => null,
    Legend: () => null, Cell: () => null, LabelList: () => null, ReferenceArea: () => null,
  };
});

describe("rapportagesamenvatting", () => {
  beforeEach(() => {
    state.chart = [];
    state.dryIce.mockResolvedValue([{ total_kg: 0, total_orders: 0 }]);
  });
  it("gebruikt digitale en externe uitsluitingen ook voor de dagelijkse grafiek en de vergelijkingsperiode", async () => {
    render(<ProductionReports dateRange={{ from: new Date(2026, 0, 8), to: new Date(2026, 0, 9) }} hideDigital hideExternal />);
    await waitFor(() => expect(state.chart.reduce((total, row) => total + row.cylinders, 0)).toBe(20));
    expect(state.chart[0]?.prevCylinders).toBe(10);
  });
  it("toont geen nultotaal als de droogijsgegevens niet geladen zijn", async () => {
    state.dryIce.mockRejectedValue(new Error("Geen gegevens beschikbaar"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ProductionReports dateRange={{ from: new Date(2026, 0, 8), to: new Date(2026, 0, 9) }} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(state.chart).toEqual([]);
    error.mockRestore();
  });
});