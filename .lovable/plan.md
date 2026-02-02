
# Plan: Fix Stock Data Values

## Problem Identified

The mock data in `StockSummaryWidget.tsx` has incorrect values for "Lucht Inhalatie (tech) (50L)":

| Field | Current (Wrong) | Excel (Correct) |
|-------|-----------------|-----------------|
| averageConsumption | 8 | 11 |
| numberOnStock | 4 | 3 |
| difference | -4 | -8 |

Additionally, the other mock items in the list are fictional and should be replaced with actual data from the Excel file.

---

## Solution

Update the `mockStockData` array in `src/components/production/StockSummaryWidget.tsx` to use the actual values from the Voorraadbeheer.xlsx file.

### Updated Mock Data (first 15 items from Excel)

```typescript
const mockStockData: StockItem[] = [
  { subCode: "250049", description: "Lucht Inhalatie (tech) (50L)", averageConsumption: 11, numberOnStock: 3, difference: -8 },
  { subCode: "201112", description: "Zuurstof Medicinaal Gasv. SOL act. geint. 300bar (1L)", averageConsumption: 5, numberOnStock: 1, difference: -4 },
  { subCode: "201107", description: "Zuurstof Medicinaal Gasv. SOL P.I. (1L)", averageConsumption: 5, numberOnStock: 3, difference: -2 },
  { subCode: "205408", description: "Kooldioxide E.P. Alu P.I. (5L)", averageConsumption: 2, numberOnStock: 1, difference: -1 },
  { subCode: "210050", description: "Lucht (10L)", averageConsumption: 2, numberOnStock: 1, difference: -1 },
  { subCode: "250045", description: "Lucht Synth. Medicinaal Gasv. SOL (50L)", averageConsumption: 3, numberOnStock: 2, difference: -1 },
  { subCode: "202507", description: "Distikstofoxide Medicinaal SOL P.I. (2L)", averageConsumption: 2, numberOnStock: 2, difference: 0 },
  { subCode: "205407", description: "Kooldioxide E.P. P.I. (5L)", averageConsumption: 3, numberOnStock: 3, difference: 0 },
  { subCode: "270382", description: "Pakket AliSOL Stikstof (16x50L)", averageConsumption: 1, numberOnStock: 1, difference: 0 },
  { subCode: "270840", description: "Pakket Helium 5.0 (16x50L)", averageConsumption: 1, numberOnStock: 1, difference: 0 },
  { subCode: "250700", description: "Acetyleen (50L)", averageConsumption: 2, numberOnStock: 3, difference: 1 },
  { subCode: "250288", description: "12% O2 in N2 (50L)", averageConsumption: 3, numberOnStock: 5, difference: 2 },
  { subCode: "250370", description: "Argon 5.0 300bar (50L)", averageConsumption: 7, numberOnStock: 10, difference: 3 },
  { subCode: "250383", description: "AliSOL 028 (50L)", averageConsumption: 8, numberOnStock: 13, difference: 5 },
  { subCode: "250350", description: "Argon 5.0 (50L)", averageConsumption: 1, numberOnStock: 17, difference: 16 },
];
```

---

## File to Modify

| File | Change |
|------|--------|
| `src/components/production/StockSummaryWidget.tsx` | Replace mock data with actual Excel values |

---

## Result

After this fix:
- "Lucht Inhalatie (tech) (50L)" will correctly show **-8** difference
- The hover card will display accurate stock levels from the Excel
- Status categories will reflect real inventory health
