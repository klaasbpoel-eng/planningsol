export type Depot = "emmen" | "tilburg";
export type VehicleType = "truck" | "courier" | "mixed";
export type ViewTab = "klanten" | "dag" | "kaart" | "strategie";
export type ADRClass = "oxidizer" | "flammable" | "inert" | "none";
export type Trend = "rising" | "stable" | "declining" | "new";

export interface CustomerSummary {
  key: string;
  depot: Depot;
  name: string;
  city: string;
  province: string;
  zip: string;
  street: string;
  zone: string;
  zoneShort: string;
  vehicleType: VehicleType;
  totalDeliveries: number;
  perWeek: number;
  dowCounts: number[];        // index 0–6 (Sun–Sat)
  preferredDays: number[];    // Mon–Fri indices with >15% share
  isMedical: boolean;
  cylinders: number;
  topProducts: string[];
  topProductDetails: { name: string; container: string; capacity: number }[];
  trend: Trend;
  recentDeliveries: number;  // last 3 months
}

export interface DayAssignment {
  preferred_day:      number | null;
  vehicle_type:       string | null;
  depot_override:     string | null;
  notes:              string | null;
  urgent:             boolean;
  time_window_start:  string | null;
  time_window_end:    string | null;
  active:             boolean;
}

export interface GeoPoint {
  customer: CustomerSummary;
  lat: number;
  lng: number;
}

export type TspGroupResult = {
  ordered: GeoPoint[];
  totalKm: number;
  withoutGeo: CustomerSummary[];
};
