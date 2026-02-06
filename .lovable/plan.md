
# Plan: Operator Interface Restricties Corrigeren

## Probleem Analyse

Na analyse van de code zijn er verschillende bugs ontdekt waardoor operators onterecht edit/delete functionaliteit zien:

### Bug 1: DryIcePlanning.tsx - Desktop Tabel Acties
**Locatie:** Lines 592-612
**Probleem:** De actie-buttons (Edit/Delete) binnen de tabelcel worden NIET individueel gecontroleerd op permissions. Ze worden altijd beide getoond als de actie-kolom zichtbaar is.

```text
Huidige code:
{(permissions?.canEditOrders || permissions?.canDeleteOrders) && (
  <TableCell>
    <Button onClick={handleEditOrder}>Edit</Button>  // NIET GECHECKT!
    <Button onClick={handleDeleteClick}>Delete</Button> // NIET GECHECKT!
  </TableCell>
)}
```

### Bug 2: GasCylinderPlanning.tsx - Mobile Status Change
**Locatie:** Line 620
**Probleem:** `onStatusChange={handleStatusChange}` wordt ALTIJD doorgegeven aan MobileOrderCard, ongeacht permissions.

### Bug 3: GasCylinderPlanning.tsx - Desktop Status Dropdown
**Locatie:** Lines 742-756
**Probleem:** De status-dropdown is ALTIJD zichtbaar en actief - geen permission check. Dit is inconsistent met DryIcePlanning waar dit wel correct is.

## Technische Oplossing

### Stap 1: DryIcePlanning.tsx - Individual Button Checks

Aanpassen van lines 592-612 om individuele permission checks toe te voegen:

```text
{(permissions?.canEditOrders || permissions?.canDeleteOrders) && (
  <TableCell>
    <div className="flex items-center gap-1">
      {permissions?.canEditOrders && (
        <Button onClick={handleEditOrder}>
          <Edit2 />
        </Button>
      )}
      {permissions?.canDeleteOrders && (
        <Button onClick={handleDeleteClick}>
          <Trash2 />
        </Button>
      )}
    </div>
  </TableCell>
)}
```

### Stap 2: GasCylinderPlanning.tsx - Mobile Card Fix

Aanpassen van line 620:

```text
// Van:
onStatusChange={handleStatusChange}

// Naar:
onStatusChange={permissions?.canEditOrders ? handleStatusChange : undefined}
```

### Stap 3: GasCylinderPlanning.tsx - Desktop Status Dropdown

Aanpassen van lines 742-756 om consistent te zijn met DryIcePlanning:

```text
<TableCell>
  {permissions?.canEditOrders ? (
    <Select value={order.status} onValueChange={(v) => handleStatusChange(order.id, v)}>
      ...
    </Select>
  ) : (
    <StatusBadge status={order.status} />
  )}
</TableCell>
```

### Stap 4: GasCylinderPlanning.tsx - Desktop Action Buttons Check

Toevoegen van individuele permission checks voor de edit/delete buttons (lines 758-778).

## Bestanden die Gewijzigd Worden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/production/DryIcePlanning.tsx` | Individuele permission checks voor Edit/Delete buttons |
| `src/components/production/GasCylinderPlanning.tsx` | Mobile status change check, Desktop status dropdown + action buttons |

## Verwacht Resultaat

Na implementatie:

| Actie | Admin | Supervisor | Operator |
|-------|-------|------------|----------|
| View orders | Ja | Ja | Ja |
| Create orders | Ja | Ja | Ja |
| Edit orders | Ja | Ja | Nee |
| Delete orders | Ja | Ja | Nee |
| Change status | Ja | Ja | Nee |

Operators zien alleen:
- De order lijst (read-only)
- Status als badge (niet als dropdown)
- Geen edit/delete knoppen
- De "Nieuwe productieorder" button
