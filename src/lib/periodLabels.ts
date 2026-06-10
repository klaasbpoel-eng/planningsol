const MONTH_NAMES_NL = [
  "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

/**
 * Periode-label suffix gebruikt voor grafiek-beschrijvingen, lege-staatmeldingen
 * en headers. Eén bron van waarheid voor "{jaar} YTD t/m {maand}" of
 * "{jaar} jaartotaal".
 */
export function periodLabel(year: number, ytdMode: boolean, todayMonth: number, monthNames: string[] = MONTH_NAMES_NL): string {
  if (ytdMode) {
    const m = monthNames[Math.max(0, Math.min(11, todayMonth - 1))];
    return `${year} YTD t/m ${m}`;
  }
  return `${year} jaartotaal`;
}

/** Korte jaar-suffix voor kolomheaders en legend: "2026 YTD" of "2026". */
export function yearWithYtdSuffix(year: number, ytdMode: boolean): string {
  return ytdMode ? `${year} YTD` : `${year}`;
}

/** Rij-label voor de totaalrij onderaan de gastype-tabel. */
export function totalsRowLabel(year: number, ytdMode: boolean, todayMonth: number, monthNames: string[] = MONTH_NAMES_NL): string {
  if (ytdMode) {
    const m = monthNames[Math.max(0, Math.min(11, todayMonth - 1))];
    return `Totaal YTD t/m ${m}`;
  }
  return `Totaal ${year} jaartotaal`;
}