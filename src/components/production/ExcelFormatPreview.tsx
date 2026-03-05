import { useState } from "react";
import * as XLSX from "xlsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, Download, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExcelFormatPreviewProps {
  headers: string[];
  rows: string[][];
  note?: string;
  templateFileName?: string;
  loading?: boolean;
}

function downloadTemplate(headers: string[], rows: string[][], fileName: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, fileName);
}

export function ExcelFormatPreview({ headers, rows, note, templateFileName = "template.xlsx", loading = false }: ExcelFormatPreviewProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-5 w-full">
      <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mx-auto">
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Zo moet je bestand eruitzien
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="rounded-lg border bg-muted/20 p-4 text-left space-y-3">
          {/* Column name badges with checkmarks */}
          <div className="flex flex-wrap gap-1.5">
            {headers.map((h, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {h}
              </span>
            ))}
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-md border bg-background">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  {headers.map((h, i) => (
                    <th key={i} className="px-2.5 py-2 font-semibold text-muted-foreground whitespace-nowrap text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={headers.length} className="px-2.5 py-4 text-center text-muted-foreground">
                      Voorbeelddata laden...
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2.5 py-1.5 whitespace-nowrap font-mono text-foreground/80">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Note + download button */}
          <div className="flex items-start justify-between gap-3">
            {note && (
              <p className="text-[11px] text-muted-foreground leading-relaxed pt-0.5">{note}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 ml-auto shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                downloadTemplate(headers, rows, templateFileName);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Download template
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
