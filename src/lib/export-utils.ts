import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

// Types for export data
export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportData {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
  dateRange?: { from: Date; to: Date };
  location?: string;
}

/**
 * Export data to Excel file
 */
export function exportToExcel(data: ExportData, filename?: string): void {
  const workbook = XLSX.utils.book_new();

  // Create header rows
  const headerRows: (string | number)[][] = [
    [data.title],
    [],
  ];

  if (data.subtitle) {
    headerRows.push([data.subtitle]);
    headerRows.push([]);
  }

  if (data.dateRange) {
    headerRows.push([
      `Periode: ${format(data.dateRange.from, "d MMMM yyyy", { locale: nl })} - ${format(data.dateRange.to, "d MMMM yyyy", { locale: nl })}`,
    ]);
  }

  if (data.location) {
    headerRows.push([`Locatie: ${data.location}`]);
  }

  headerRows.push([]);

  // Add column headers
  headerRows.push(data.columns.map((col) => col.header));

  // Add data rows
  const dataRows = data.rows.map((row) =>
    data.columns.map((col) => row[col.key] ?? "")
  );

  const allRows = [...headerRows, ...dataRows];

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(allRows);

  // Set column widths
  const colWidths = data.columns.map((col) => ({
    wch: col.width || Math.max(col.header.length, 15),
  }));
  worksheet["!cols"] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rapport");

  // Generate filename
  const exportFilename =
    filename ||
    `${data.title.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;

  // Save file
  XLSX.writeFile(workbook, exportFilename);
}

/**
 * Export data to PDF file
 */
export function exportToPDF(data: ExportData, filename?: string): void {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.title, 14, 20);

  let yPosition = 30;

  // Add subtitle if present
  if (data.subtitle) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(data.subtitle, 14, yPosition);
    yPosition += 8;
  }

  // Add date range
  if (data.dateRange) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Periode: ${format(data.dateRange.from, "d MMMM yyyy", { locale: nl })} - ${format(data.dateRange.to, "d MMMM yyyy", { locale: nl })}`,
      14,
      yPosition
    );
    yPosition += 6;
  }

  // Add location
  if (data.location) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Locatie: ${data.location}`, 14, yPosition);
    yPosition += 6;
  }

  // Add generation timestamp
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Gegenereerd op: ${format(new Date(), "d MMMM yyyy HH:mm", { locale: nl })}`,
    14,
    yPosition
  );
  yPosition += 10;

  doc.setTextColor(0);

  // Add table
  autoTable(doc, {
    head: [data.columns.map((col) => col.header)],
    body: data.rows.map((row) =>
      data.columns.map((col) => String(row[col.key] ?? ""))
    ),
    startY: yPosition,
    theme: "striped",
    headStyles: {
      fillColor: [59, 130, 246], // Primary blue
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
  });

  // Generate filename
  const exportFilename =
    filename ||
    `${data.title.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`;

  // Save file
  doc.save(exportFilename);
}

/**
 * Export a chart/element to PDF by capturing it as an image
 */
export async function exportChartToPDF(
  elementId: string,
  title: string,
  options?: {
    subtitle?: string;
    dateRange?: { from: Date; to: Date };
    location?: string;
  }
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID "${elementId}" not found`);
    return;
  }

  try {
    // Capture the element as a canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Higher resolution
      backgroundColor: "#ffffff",
      logging: false,
    });

    const doc = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    });

    // Add title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, 20);

    let yPosition = 30;

    // Add subtitle
    if (options?.subtitle) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(options.subtitle, 14, yPosition);
      yPosition += 8;
    }

    // Add date range
    if (options?.dateRange) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(
        `Periode: ${format(options.dateRange.from, "d MMMM yyyy", { locale: nl })} - ${format(options.dateRange.to, "d MMMM yyyy", { locale: nl })}`,
        14,
        yPosition
      );
      yPosition += 6;
    }

    // Add location
    if (options?.location) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Locatie: ${options.location}`, 14, yPosition);
      yPosition += 6;
    }

    // Add timestamp
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Gegenereerd op: ${format(new Date(), "d MMMM yyyy HH:mm", { locale: nl })}`,
      14,
      yPosition
    );
    yPosition += 15;

    // Calculate dimensions to fit on page
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - 28; // 14px margin on each side
    const maxHeight = pageHeight - yPosition - 20;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);

    const finalWidth = imgWidth * ratio;
    const finalHeight = imgHeight * ratio;

    // Add image
    const imgData = canvas.toDataURL("image/png");
    doc.addImage(imgData, "PNG", 14, yPosition, finalWidth, finalHeight);

    // Save
    const filename = `${title.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("Error exporting chart to PDF:", error);
    throw error;
  }
}

/**
 * Helper to format numbers for export
 */
export function formatExportNumber(value: number, decimals = 0): string {
  return value.toLocaleString("nl-NL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
