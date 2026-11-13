import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Database,
  Factory,
  FileUp,
  Home,
  Inbox,
  ListChecks,
  ScanBarcode,
  Settings,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Truck,
  Users,
  CalendarRange,
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
  id: string;
  label: string;
  icon: LucideIcon;
  /** Only shown to administrators. Access itself is still enforced by the page and the database. */
  adminOnly?: boolean;
  items: NavigationItem[];
}

/** Start page: today's tasks, orders and leave. */
export const HOME_ITEM: NavigationItem = {
  id: "vandaag",
  path: "/",
  label: "Vandaag",
  icon: Home,
  keywords: ["start", "home", "dagoverzicht", "dag", "taken", "overzicht"],
};

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    id: "planning",
    label: "Planning",
    icon: CalendarRange,
    items: [
      { id: "kalender", path: "/kalender", label: "Kalender", icon: CalendarDays, keywords: ["agenda", "planning", "datum"] },
      { id: "productie", path: "/productie", label: "Productie", icon: Factory, keywords: ["productie", "gas", "droogijs", "cilinders"] },
      { id: "barcode", path: "/barcode", label: "Barcodegenerator", icon: ScanBarcode, keywords: ["scan", "label", "sticker", "barcode"] },
    ],
  },
  {
    id: "aanvragen",
    label: "Aanvragen",
    icon: Inbox,
    items: [
      { id: "verlof", path: "/verlof", label: "Verlof", icon: Clock, keywords: ["vrij", "vakantie", "afwezig", "verlof"] },
      { id: "bestellingen", path: "/interne-bestellingen", label: "Interne bestellingen", icon: Truck, keywords: ["order", "bestelling", "levering", "transport"] },
      { id: "vrijgaves", path: "/vrijgaves", label: "Vrijgaves", icon: FileUp, keywords: ["vrijgave", "goedkeuring"] },
    ],
  },
  {
    id: "veiligheid",
    label: "Veiligheid",
    icon: ShieldCheck,
    items: [
      { id: "pgs", path: "/pgs-register", label: "PGS-register & opslag", icon: ShieldAlert, keywords: ["pgs", "opslag", "gevaarlijke stoffen", "plattegrond", "kaart", "omgevingswet"] },
      { id: "toolbox", path: "/toolbox", label: "Toolbox", icon: BookOpen, keywords: ["veiligheid", "instructie", "training", "toolbox"] },
    ],
  },
  {
    id: "beheer",
    label: "Beheer",
    icon: Shield,
    adminOnly: true,
    items: [
      { id: "admin-requests", path: "/admin?tab=requests", label: "Verlofaanvragen", icon: ListChecks, keywords: ["goedkeuren", "verlof", "aanvragen", "beheer"] },
      { id: "admin-tasks", path: "/admin?tab=tasks", label: "Taken", icon: ClipboardList, keywords: ["taken", "todo", "beheer"] },
      { id: "admin-calendar", path: "/admin?tab=calendar", label: "Teamkalender", icon: CalendarDays, keywords: ["team", "aanwezigheid", "kalender"] },
      { id: "admin-employees", path: "/admin?tab=employees", label: "Medewerkers", icon: Users, keywords: ["personeel", "gebruikers", "aanmeldingen", "toegang"] },
      { id: "admin-logbook", path: "/admin?tab=logbook", label: "Toolbox-logboek", icon: ClipboardCheck, keywords: ["toolbox", "logboek", "voltooid"] },
      { id: "admin-settings", path: "/admin?tab=settings", label: "Instellingen", icon: Settings, keywords: ["settings", "configuratie", "beheer"] },
      { id: "admin-sync", path: "/sync-instellingen", label: "Synchronisatie", icon: Database, keywords: ["sync", "sql", "koppeling", "import"] },
    ],
  },
];

export const NAVIGATION_ITEMS: NavigationItem[] = [HOME_ITEM, ...NAVIGATION_GROUPS.flatMap((group) => group.items)];

/** Groups visible for the current user; admin-only groups are hidden for everyone else. */
export function getNavigationGroups(isAdmin: boolean): NavigationGroup[] {
  return NAVIGATION_GROUPS.filter((group) => !group.adminOnly || isAdmin);
}

const ADMIN_DEFAULT_TAB = "requests";

/** Whether a menu item matches the current location, including `?tab=` destinations. */
export function isNavigationItemActive(item: Pick<NavigationItem, "path">, pathname: string, search = ""): boolean {
  const [itemPath, itemQuery] = item.path.split("?");
  if (itemPath !== pathname) return false;
  if (!itemQuery) return true;
  const wantedTab = new URLSearchParams(itemQuery).get("tab");
  const currentTab = new URLSearchParams(search).get("tab") ?? (pathname === "/admin" ? ADMIN_DEFAULT_TAB : null);
  return wantedTab === currentTab;
}

/** Admin panel sections, derived from the Beheer group so sidebar and menus stay identical. */
export const ADMIN_SECTIONS = (NAVIGATION_GROUPS.find((group) => group.id === "beheer")?.items ?? []).map((item) => {
  const [path, query] = item.path.split("?");
  return { ...item, tab: path === "/admin" && query ? new URLSearchParams(query).get("tab") : null };
});

/** Production tabs that moved to the Veiligheid section, with their new destination. */
export const MOVED_PRODUCTION_TABS: Record<string, string> = {
  "pgs-register": "/pgs-register?tab=register",
  plattegrond: "/pgs-register?tab=plattegrond",
};
