import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

interface VirtualizedTableProps<T> {
  data: T[];
  columns: {
    header: React.ReactNode;
    accessor: (item: T) => React.ReactNode;
    className?: string;
    headerClassName?: string;
  }[];
  rowHeight?: number;
  maxHeight?: number;
  className?: string;
  emptyMessage?: React.ReactNode;
}

export function VirtualizedTable<T extends { id: string }>({
  data,
  columns,
  rowHeight = 53,
  maxHeight = 600,
  className,
  emptyMessage = "Geen data",
}: VirtualizedTableProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)}>
      {/* Fixed Header */}
      <div className="border-b bg-muted/30">
        <table className="w-full table-fixed">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    "h-12 px-4 text-left align-middle font-medium text-muted-foreground",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: maxHeight }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          <table className="w-full table-fixed">
            <tbody>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = data[virtualRow.index];
                return (
                  <tr
                    key={item.id}
                    className="border-b transition-colors hover:bg-muted/50"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: "table",
                      tableLayout: "fixed",
                    }}
                  >
                    {columns.map((col, colIndex) => (
                      <td
                        key={colIndex}
                        className={cn("p-4 align-middle", col.className)}
                      >
                        {col.accessor(item)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

VirtualizedTable.displayName = "VirtualizedTable";
