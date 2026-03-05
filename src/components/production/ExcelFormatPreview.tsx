import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExcelFormatPreviewProps {
  headers: string[];
  rows: string[][];
  note?: string;
}

export function ExcelFormatPreview({ headers, rows, note }: ExcelFormatPreviewProps) {
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
          {note && (
            <p className="text-[11px] text-muted-foreground mt-2">{note}</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
