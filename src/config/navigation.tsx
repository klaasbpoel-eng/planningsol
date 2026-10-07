import {
  BookOpen,
  CalendarDays,
  Clock,
  Factory,
  FileUp,
  ScanBarcode,
  Truck,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  id: string;
  path: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  keywords: string[];
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    label: "Planning",
    items: [
      { id: "kalender", path: "/kalender", label: "Kalender", icon: CalendarDays, keywords: ["agenda", "planning", "datum"] },
      { id: "productie", path: "/productie", label: "Productieplanning", shortLabel: "Productie", icon: Factory, keywords: ["productie", "gas", "droogijs"] },
      { id: "dagoverzicht", path: "/dagoverzicht", label: "Dagelijks overzicht", shortLabel: "Dag", icon: CalendarDays, keywords: ["dag", "vandaag", "taken"] },
    ],
  },
  {
    label: "Beheer",
    items: [
      { id: "bestellingen", path: "/interne-bestellingen", label: "Interne bestellingen", shortLabel: "Bestellingen", icon: Truck, keywords: ["order", "bestelling", "levering"] },
      { id: "verlof", path: "/verlof", label: "Verlof & aanvragen", shortLabel: "Verlof", icon: Clock, keywords: ["vrij", "vakantie", "afwezig"] },
      { id: "vrijgaves", path: "/vrijgaves", label: "Vrijgaves", icon: FileUp, keywords: ["vrijgave", "goedkeuring"] },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "toolbox", path: "/toolbox", label: "Toolbox", icon: BookOpen, keywords: ["veiligheid", "instructie", "training"] },
      { id: "barcode", path: "/barcode", label: "Barcodegenerator", shortLabel: "Barcode", icon: ScanBarcode, keywords: ["scan", "label", "sticker"] },
    ],
  },
];

export const NAVIGATION_ITEMS = NAVIGATION_GROUPS.flatMap((group) => group.items);