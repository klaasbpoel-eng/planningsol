

# Plan: Bewerk- en Verwijderknoppen Zichtbaar Maken voor Operators

## Probleem

De bewerk- en verwijderknoppen worden niet getoond voor operators. Dit komt doordat de **frontend permissie-configuratie** operators geen toegang geeft tot deze functies, terwijl de database RLS policies dit wel toestaan.

| Onderdeel | Huidige waarde |
|-----------|----------------|
| `operator.canEditOrders` | `false` |
| `operator.canDeleteOrders` | `false` |

De knoppen worden alleen getoond als deze permissies `true` zijn:
```text
{permissions?.canEditOrders && <EditButton />}
{permissions?.canDeleteOrders && <DeleteButton />}
```

## Oorzaak

De permissie-mapping in `useUserPermissions.ts` definieert dat operators geen orders kunnen bewerken of verwijderen. Dit was correct voordat de RLS policies werden toegevoegd, maar nu de database-laag dit toestaat, moet de frontend dit ook toestaan.

## Oplossing

Wijzig de `ROLE_PERMISSIONS` constante in `useUserPermissions.ts` om operators toe te staan orders te bewerken en verwijderen.

## Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useUserPermissions.ts` | Zet `canEditOrders: true` en `canDeleteOrders: true` voor de `operator` rol |

## Code Wijziging

In het `ROLE_PERMISSIONS` object, de `operator` sectie aanpassen:

```text
Van:
  operator: {
    ...
    canEditOrders: false,
    canDeleteOrders: false,
    ...
  }

Naar:
  operator: {
    ...
    canEditOrders: true,
    canDeleteOrders: true,
    ...
  }
```

## Technische Details

De wijziging is eenvoudig: twee boolean waarden van `false` naar `true` veranderen. Dit zorgt ervoor dat:

1. De bewerk-knop (potlood icoon) zichtbaar wordt voor operators
2. De verwijder-knop (prullenbak icoon) zichtbaar wordt voor operators
3. De status-dropdown werkt al correct (geen permissie-check)
4. De mobiele weergave (MobileOrderCard) toont ook de knoppen (gebruikt dezelfde permissies)

## Geen Database Wijzigingen Nodig

De RLS policies zijn al correct geconfigureerd. Dit is puur een frontend permissie-aanpassing.

