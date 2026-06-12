import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

type PlaceType = "permanent" | "temporary" | "crossdock";

interface Place {
  id: string;
  location: string;
  name: string;
  code: string | null;
  place_type: PlaceType;
  max_residence_hours: number | null;
  pgs_guideline: string;
  description: string | null;
  notes: string | null;
}

interface SubstanceRow {
  id: string;
  storage_place_id: string | null;
  location: string;
  pgs_guideline: string;
  max_allowed_kg: number;
  current_stock_kg: number;
  un_number: string | null;
  gevi_number: string | null;
  hazard_symbols: string[];
  storage_class: string | null;
  notes: string | null;
  gas_type_name: string;
}

interface TankRow {
  id: string;
  storage_place_id: string | null;
  location: string;
  tank_name: string;
  tank_number: string | null;
  capacity_kg: number;
  current_level_kg: number;
  pgs_guideline: string;
  un_number: string | null;
  hazard_symbols: string[];
  gas_type_name: string;
}

const LOC_LABEL: Record<string, string> = { sol_emmen: "Emmen", sol_tilburg: "Tilburg" };
const TYPE_LABEL: Record<PlaceType, string> = { permanent: "Vast", temporary: "Tijdelijk/incidenteel", crossdock: "Crossdock" };

async function loadData() {
  const [plRes, subRes, tankRes] = await Promise.all([
    (supabase as any).from("storage_places").select("*").order("location").order("name"),
    (supabase as any).from("pgs_substances").select("*, gas_types(name)"),
    (supabase as any).from("bulk_storage_tanks").select("*, gas_types(name)"),
  ]);
  const places: Place[] = plRes.data || [];
  const substances: SubstanceRow[] = (subRes.data || []).map((s: any) => ({
    ...s,
    gas_type_name: s.gas_types?.name || "(Onbekende stof)",
  }));
  const tanks: TankRow[] = (tankRes.data || []).map((t: any) => ({
    ...t,
    gas_type_name: t.gas_types?.name || "(Onbekende stof)",
  }));
  return { places, substances, tanks };
}

export async function generatePGSPerPlacePDF(filterLocation?: string, filterTypes?: PlaceType[]) {
  const { places, substances, tanks } = await loadData();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Cover header
  doc.setFontSize(18);
  doc.text("PGS Register — registratie per opslagplaats", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Conform PGS 15:2021 v1.0 (augustus 2021) — gegenereerd ${new Date().toLocaleDateString("nl-NL")}`, 14, 24);
  doc.setTextColor(0);

  let cursorY = 30;
  let filteredPlaces = places.filter(p => !filterLocation || p.location === filterLocation);
  if (filterTypes && filterTypes.length > 0) {
    filteredPlaces = filteredPlaces.filter(p => filterTypes.includes(p.place_type));
  }
  // Add "unassigned" pseudo-place at the end for substances/tanks zonder koppeling
  const allPlaces: (Place & { __virtual?: boolean })[] = [
    ...filteredPlaces,
    { id: "__none__", location: filterLocation || "sol_emmen", name: "(Niet toegewezen)", code: null, place_type: "permanent", max_residence_hours: null, pgs_guideline: "—", description: null, notes: null, __virtual: true },
  ];

  let isFirst = true;
  for (const place of allPlaces) {
    const subs = substances.filter(s => (s.storage_place_id || "__none__") === place.id && (!filterLocation || s.location === filterLocation));
    const placeTanks = tanks.filter(t => (t.storage_place_id || "__none__") === place.id && (!filterLocation || t.location === filterLocation));
    const isIncidental = place.place_type === "temporary" || place.place_type === "crossdock";
    // Always include temporary/crossdock places (also when empty) — vereist voor PGS 15:2021 registratie.
    // Sla alleen "(Niet toegewezen)" en lege vaste plekken over.
    if (subs.length === 0 && placeTanks.length === 0 && !isIncidental) continue;
    if ((place as any).__virtual && subs.length === 0 && placeTanks.length === 0) continue;

    if (!isFirst) {
      doc.addPage();
      cursorY = 18;
    }
    isFirst = false;

    doc.setFontSize(13);
    doc.setFont(undefined as any, "bold");
    doc.text(`${place.name}`, 14, cursorY);
    doc.setFont(undefined as any, "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    const meta = [
      `Locatie: ${LOC_LABEL[place.location] || place.location}`,
      `Type: ${TYPE_LABEL[place.place_type]}`,
      `PGS: ${place.pgs_guideline}`,
      place.max_residence_hours != null ? `Max. verblijftijd: ${place.max_residence_hours} u` : null,
      place.code ? `Code: ${place.code}` : null,
    ].filter(Boolean).join("   |   ");
    doc.text(meta, 14, cursorY + 5);
    if (place.description) doc.text(place.description, 14, cursorY + 10);
    doc.setTextColor(0);
    cursorY += place.description ? 14 : 9;

    if (subs.length > 0) {
      autoTable(doc, {
        startY: cursorY,
        head: [["Stof", "UN-nr", "GEVI", "PGS", "GHS", "Klasse", "Max. (kg)", "Huidig (kg)", "% bezetting", "Opmerking"]],
        body: subs.map(s => {
          const pct = s.max_allowed_kg > 0 ? Math.round((s.current_stock_kg / s.max_allowed_kg) * 100) : 0;
          return [
            s.gas_type_name,
            s.un_number || "—",
            s.gevi_number || "—",
            s.pgs_guideline || "—",
            (s.hazard_symbols || []).join(", ") || "—",
            s.storage_class || "—",
            s.max_allowed_kg.toLocaleString("nl-NL"),
            s.current_stock_kg.toLocaleString("nl-NL"),
            `${pct}%`,
            s.notes || "—",
          ];
        }),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [220, 38, 38] },
      });
      cursorY = (doc as any).lastAutoTable.finalY + 6;
    }

    if (placeTanks.length > 0) {
      autoTable(doc, {
        startY: cursorY,
        head: [["Bulktank", "Tank-nr", "Stof", "UN-nr", "PGS", "Capaciteit (kg)", "Huidig (kg)", "% bezetting"]],
        body: placeTanks.map(t => {
          const pct = t.capacity_kg > 0 ? Math.round((t.current_level_kg / t.capacity_kg) * 100) : 0;
          return [
            t.tank_name,
            t.tank_number || "—",
            t.gas_type_name,
            t.un_number || "—",
            t.pgs_guideline || "—",
            t.capacity_kg.toLocaleString("nl-NL"),
            t.current_level_kg.toLocaleString("nl-NL"),
            `${pct}%`,
          ];
        }),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [37, 99, 235] },
      });
      cursorY = (doc as any).lastAutoTable.finalY + 6;
    }

    if (subs.length === 0 && placeTanks.length === 0 && isIncidental) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Geen actuele voorraad geregistreerd. Deze locatie wordt uitsluitend incidenteel gebruikt.", 14, cursorY);
      doc.setTextColor(0);
      cursorY += 6;
    }

    if (place.place_type === "crossdock" || place.place_type === "temporary") {
      doc.setFontSize(8);
      doc.setTextColor(120);
      const note = place.place_type === "crossdock"
        ? "Crossdock: deze tabel toont wat hier maximaal aanwezig kán zijn, niet de actuele voorraad."
        : `Tijdelijke/incidentele opslag${place.max_residence_hours != null ? ` — maximale verblijftijd ${place.max_residence_hours} uur` : ""}.`;
      doc.text(note, 14, cursorY);
      doc.setTextColor(0);
      cursorY += 6;
    }
  }

  // Footer pagina-nummering
  const totalPages = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`PGS Register per opslagplaats — pagina ${i} van ${totalPages}`, 14, 200);
  }

  doc.save(`pgs-register-per-opslagplaats-${new Date().toISOString().split("T")[0]}.pdf`);
}

export async function generatePGSPerPlaceExcel(filterLocation?: string, filterTypes?: PlaceType[]) {
  const { places, substances, tanks } = await loadData();
  const wb = XLSX.utils.book_new();

  // Overview sheet
  const overviewRows: any[] = [];
  let filteredPlaces = places.filter(p => !filterLocation || p.location === filterLocation);
  if (filterTypes && filterTypes.length > 0) {
    filteredPlaces = filteredPlaces.filter(p => filterTypes.includes(p.place_type));
  }
  for (const place of filteredPlaces) {
    const subs = substances.filter(s => s.storage_place_id === place.id);
    const placeTanks = tanks.filter(t => t.storage_place_id === place.id);
    overviewRows.push({
      Opslagplaats: place.name,
      Code: place.code || "",
      Locatie: LOC_LABEL[place.location] || place.location,
      Type: TYPE_LABEL[place.place_type],
      "Max. verblijftijd (u)": place.max_residence_hours ?? "",
      PGS: place.pgs_guideline,
      "Aantal stoffen": subs.length,
      "Aantal tanks": placeTanks.length,
      "Totale max. (kg)": subs.reduce((a, s) => a + Number(s.max_allowed_kg || 0), 0) + placeTanks.reduce((a, t) => a + Number(t.capacity_kg || 0), 0),
      "Totaal aanwezig (kg)": subs.reduce((a, s) => a + Number(s.current_stock_kg || 0), 0) + placeTanks.reduce((a, t) => a + Number(t.current_level_kg || 0), 0),
      Beschrijving: place.description || "",
    });
  }
  const wsOverview = XLSX.utils.json_to_sheet(overviewRows);
  XLSX.utils.book_append_sheet(wb, wsOverview, "Overzicht");

  // One sheet per place
  for (const place of filteredPlaces) {
    const subs = substances.filter(s => s.storage_place_id === place.id);
    const placeTanks = tanks.filter(t => t.storage_place_id === place.id);
    const isIncidental = place.place_type === "temporary" || place.place_type === "crossdock";
    if (subs.length === 0 && placeTanks.length === 0 && !isIncidental) continue;

    const rows: any[] = subs.map(s => ({
      Soort: "Stof",
      Naam: s.gas_type_name,
      "UN-nr": s.un_number || "",
      GEVI: s.gevi_number || "",
      PGS: s.pgs_guideline,
      GHS: (s.hazard_symbols || []).join(", "),
      Klasse: s.storage_class || "",
      "Max. (kg)": Number(s.max_allowed_kg),
      "Huidig (kg)": Number(s.current_stock_kg),
      "% bezetting": s.max_allowed_kg > 0 ? Math.round((s.current_stock_kg / s.max_allowed_kg) * 100) : 0,
      Opmerking: s.notes || "",
    }));
    for (const t of placeTanks) {
      rows.push({
        Soort: "Bulktank",
        Naam: `${t.tank_name}${t.tank_number ? ` (${t.tank_number})` : ""}`,
        "UN-nr": t.un_number || "",
        GEVI: "",
        PGS: t.pgs_guideline,
        GHS: (t.hazard_symbols || []).join(", "),
        Klasse: "",
        "Max. (kg)": Number(t.capacity_kg),
        "Huidig (kg)": Number(t.current_level_kg),
        "% bezetting": t.capacity_kg > 0 ? Math.round((t.current_level_kg / t.capacity_kg) * 100) : 0,
        Opmerking: place.place_type === "crossdock" ? `Max. verblijftijd: ${place.max_residence_hours ?? "—"} u` : "",
      });
    }
    if (rows.length === 0 && isIncidental) {
      rows.push({
        Soort: "—",
        Naam: "(Geen actuele voorraad — incidenteel gebruik)",
        "UN-nr": "",
        GEVI: "",
        PGS: place.pgs_guideline,
        GHS: "",
        Klasse: "",
        "Max. (kg)": "",
        "Huidig (kg)": "",
        "% bezetting": "",
        Opmerking: place.max_residence_hours != null ? `Max. verblijftijd: ${place.max_residence_hours} u` : "Tijdelijke/incidentele opslag",
      });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    // Excel sheet names max 31 chars, no special chars
    const sheetName = `${place.name}`.replace(/[\\/:*?\[\]]/g, "_").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || `Plaats ${place.id.slice(0, 6)}`);
  }

  XLSX.writeFile(wb, `pgs-register-per-opslagplaats-${new Date().toISOString().split("T")[0]}.xlsx`);
}
