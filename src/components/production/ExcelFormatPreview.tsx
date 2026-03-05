import { useState } from "react";
import * as XLSX from "xlsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, Download, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExcelFormatPreviewProps {
  headers: string[];
  rows: string[][];
  note?: string;
  templateFileName?: string;
}

function downloadTemplate(headers: string[], rows: string[][], fileName: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, fileName);
}

export function ExcelFormatPreview({ headers, rows, note, templateFileName = "template.xlsx" }: ExcelFormatPreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4 w-full">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto">
        <Eye className="h-3 w-3" />
        Voorbeeld bestandsindeling
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="rounded-lg border bg-muted/30 p-3 text-left">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {headers.map((h, i) => (
                    <th key={i} className="px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1.5 whitespace-nowrap font-mono">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-2">
            {note && (
              <p className="text-[11px] text-muted-foreground">{note}</p>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 ml-auto shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                downloadTemplate(headers, rows, templateFileName);
              }}
            >
              <Download className="h-3 w-3" />
              Download template
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
