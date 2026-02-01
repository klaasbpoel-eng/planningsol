

# Plan: Fix Gascilinder Overzicht Limiet (1000 orders)

## Probleem Geanalyseerd

De database query bevestigt het probleem:
- **Januari 2026**: 1445 orders in database, maar slechts 1000 getoond
- **Oorzaak**: Supabase standaardlimiet is 1000 rijen per query
- **Andere jaren**: 20.000-24.000 orders per jaar - dit wordt nog problematischer

| Jaar | Orders in DB | Getoond |
|------|-------------|---------|
| 2020 | 23.441 | 1.000 |
| 2021 | 24.313 | 1.000 |
| 2022 | 22.894 | 1.000 |
| 2023 | 21.740 | 1.000 |
| 2024 | 20.691 | 1.000 |
| 2025 | 19.398 | 1.000 |
| 2026 | 1.445 | 1.000 |

## Oplossing: Maandelijkse Paginering

Omdat er 20.000+ orders per jaar zijn, is het niet praktisch om alles tegelijk te laden. De beste oplossing is **maandelijkse filtering** in plaats van jaarvolgorde:

### Stap 1: Voeg maandfilter toe naast jaarfilter
```typescript
const [monthFilter, setMonthFilter] = useState<number>(new Date().getMonth() + 1);
```

### Stap 2: Pas query aan voor maand-specifieke data
```typescript
const fetchOrders = async () => {
  const startDate = `${yearFilter}-${String(monthFilter).padStart(2, '0')}-01`;
  // Calculate last day of month
  const lastDay = new Date(yearFilter, monthFilter, 0).getDate();
  const endDate = `${yearFilter}-${String(monthFilter).padStart(2, '0')}-${lastDay}`;
  
  const { data } = await supabase
    .from("gas_cylinder_orders")
    .select(`*, gas_type_ref:gas_types(id, name, color)`)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
    .order("scheduled_date", { ascending: true })
    .limit(5000); // Veilige limiet voor 1 maand
};
```

### Stap 3: UI maandkiezer toevoegen
Voeg een dropdown toe naast de jaarkiezer:

```typescript
<Select 
  value={String(monthFilter)} 
  onValueChange={(v) => setMonthFilter(parseInt(v))}
>
  <SelectTrigger className="w-[140px]">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {months.map((month, idx) => (
      <SelectItem key={idx + 1} value={String(idx + 1)}>
        {month}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Stap 4: Voeg "Hele jaar" optie toe
Voor gebruikers die toch alle data willen zien, voeg een optie toe die per maand itereert en combineert:

```typescript
// Optioneel: Laad alle maanden parallel voor volledig jaaroverzicht
if (monthFilter === 0) { // 0 = hele jaar
  const allMonthPromises = Array.from({ length: 12 }, (_, i) => 
    fetchMonthData(yearFilter, i + 1)
  );
  const allMonthData = await Promise.all(allMonthPromises);
  setOrders(allMonthData.flat());
}
```

---

## Verwacht Resultaat

Na deze wijziging:
- Standaard wordt de **huidige maand** getoond (max ~2.500 orders)
- Gebruikers kunnen schakelen tussen maanden
- Geen data meer gemist door de 1000-rij limiet
- Performance verbetert significant door kleinere datasets

---

## Technische Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `GasCylinderPlanning.tsx` | Voeg `monthFilter` state toe |
| `GasCylinderPlanning.tsx` | Update `fetchOrders` met maandgrenzen |
| `GasCylinderPlanning.tsx` | Voeg maand-dropdown UI toe |
| `GasCylinderPlanning.tsx` | Update useEffect dependencies |

