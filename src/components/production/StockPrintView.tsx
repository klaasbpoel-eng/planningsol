import { forwardRef } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { type StockItem } from "./StockExcelImportDialog";
import { getStockStatus, getStockStatusConfig } from "./StockStatusBadge";

interface StockPrintViewProps {
  stockData: StockItem[];
  locationLabel?: string;
}

const statusOrder = ["critical", "low", "ok", "surplus"] as const;

function sortByStatus(items: StockItem[]) {
  return [...items].sort((a, b) => {
    const aIdx = statusOrder.indexOf(getStockStatus(a.difference));
    const bIdx = statusOrder.indexOf(getStockStatus(b.difference));
    return aIdx - bIdx || a.difference - b.difference;
  });
}

function StockTable({ items, title }: { items: StockItem[]; title: string }) {
  const sorted = sortByStatus(items);
  if (sorted.length === 0) return null;

  return (
    <div className="stock-print-section">
      <h2 className="stock-print-section-title">{title} ({sorted.length})</h2>
      <table className="stock-print-table">
        <thead>
          <tr>
            <th style={{ width: "12%" }}>Code</th>
            <th style={{ width: "40%" }}>Omschrijving</th>
            <th style={{ width: "12%", textAlign: "right" }}>Gem. Verbr.</th>
            <th style={{ width: "12%", textAlign: "right" }}>Voorraad</th>
            <th style={{ width: "12%", textAlign: "right" }}>Verschil</th>
            <th style={{ width: "12%", textAlign: "center" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const status = getStockStatus(item.difference);
            const config = getStockStatusConfig(status);
            const statusColors: Record<string, string> = {
              critical: "#ef4444",
              low: "#f97316",
              ok: "#22c55e",
              surplus: "#06b6d4",
            };
            return (
              <tr key={item.subCode}>
                <td className="font-mono">{item.subCode}</td>
                <td>{item.description}</td>
                <td style={{ textAlign: "right" }}>{item.averageConsumption}</td>
                <td style={{ textAlign: "right" }}>{item.numberOnStock}</td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 600,
                    color: item.difference < 0 ? "#ef4444" : item.difference > 0 ? "#22c55e" : "#888",
                  }}
                >
                  {item.difference > 0 ? "+" : ""}
                  {item.difference}
                </td>
                <td style={{ textAlign: "center" }}>
                  <span
                    className="stock-print-badge"
                    style={{
                      backgroundColor: statusColors[status] + "20",
                      color: statusColors[status],
                      border: `1px solid ${statusColors[status]}60`,
                    }}
                  >
                    {config.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const StockPrintView = forwardRef<HTMLDivElement, StockPrintViewProps>(
  ({ stockData, locationLabel }, ref) => {
    const emmenItems = stockData.filter((item) => item.filledInEmmen !== false);
    const nonEmmenItems = stockData.filter((item) => item.filledInEmmen === false);

    return (
      <div ref={ref} className="print-stock-overview">
        <div className="stock-print-header">
          <div>
            <h1 className="stock-print-title">Voorraadoverzicht</h1>
            {locationLabel && (
              <p className="stock-print-subtitle">{locationLabel}</p>
            )}
          </div>
          <div className="stock-print-meta">
            <p>{format(new Date(), "EEEE d MMMM yyyy", { locale: nl })}</p>
            <p>{stockData.length} producten totaal</p>
          </div>
        </div>

        <StockTable items={emmenItems} title="Gevuld in Emmen" />
        <StockTable items={nonEmmenItems} title="Niet gevuld in Emmen" />
      </div>
    );
  }
);

StockPrintView.displayName = "StockPrintView";
