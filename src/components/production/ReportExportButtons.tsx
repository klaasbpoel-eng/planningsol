import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, exportToPDF, exportChartToPDF } from "@/lib/export-utils";

interface ReportExportButtonsProps {
  tableData?: {
    title: string;
    subtitle?: string;
    columns: { header: string; key: string; width?: number }[];
    rows: Record<string, string | number>[];
    dateRange?: { from: Date; to: Date };
    location?: string;
  };
  chartElementId?: string;
  chartTitle?: string;
  chartOptions?: {
    subtitle?: string;
    dateRange?: { from: Date; to: Date };
    location?: string;
  };
  disabled?: boolean;
  className?: string;
}

export function ReportExportButtons({
  tableData,
  chartElementId,
  chartTitle,
  chartOptions,
  disabled = false,
  className,
}: ReportExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExcelExport = () => {
    if (!tableData) {
      toast.error("Geen data beschikbaar voor export");
      return;
    }

    try {
      setIsExporting(true);
      exportToExcel(tableData);
      toast.success("Excel bestand gedownload");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Er ging iets mis bij het exporteren");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePDFTableExport = () => {
    if (!tableData) {
      toast.error("Geen data beschikbaar voor export");
      return;
    }

    try {
      setIsExporting(true);
      exportToPDF(tableData);
      toast.success("PDF bestand gedownload");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Er ging iets mis bij het exporteren");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePDFChartExport = async () => {
    if (!chartElementId || !chartTitle) {
      toast.error("Geen grafiek beschikbaar voor export");
      return;
    }

    try {
      setIsExporting(true);
      await exportChartToPDF(chartElementId, chartTitle, chartOptions);
      toast.success("PDF bestand gedownload");
    } catch (error) {
      console.error("Chart PDF export error:", error);
      toast.error("Er ging iets mis bij het exporteren van de grafiek");
    } finally {
      setIsExporting(false);
    }
  };

  const hasTableData = !!tableData && tableData.rows.length > 0;
  const hasChartData = !!chartElementId && !!chartTitle;

  if (!hasTableData && !hasChartData) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isExporting}
          className={className}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exporteren
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {hasTableData && (
          <>
            <DropdownMenuItem onClick={handleExcelExport}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePDFTableExport}>
              <FileText className="h-4 w-4 mr-2 text-red-600" />
              PDF (tabel)
            </DropdownMenuItem>
          </>
        )}
        {hasChartData && (
          <DropdownMenuItem onClick={handlePDFChartExport}>
            <FileText className="h-4 w-4 mr-2 text-blue-600" />
            PDF (grafiek)
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
