

## Admin bewerkingsmogelijkheid in Dagelijks Overzicht

### Probleem
De detail-dialogen in het Dagelijks Overzicht worden geopend zonder admin-rechten (`isAdmin={false}` of ontbrekend). Hierdoor kan een admin geen items bewerken of verwijderen vanuit dit scherm.

### Oplossing
De `DailyOverview` component moet de huidige gebruiker en diens admin-status ophalen, en deze doorsturen naar de dialogen.

### Wijzigingen in `src/components/dashboard/DailyOverview.tsx`

1. **Gebruiker en rol ophalen** -- Importeer `useUserPermissions` en haal de huidige user op via `supabase.auth.getUser()`. Gebruik de `isAdmin` en `permissions` uit de hook.

2. **Benodigde data ophalen voor dialogen** -- Haal `profiles` (voor taaktoewijzing) en `timeOffTypes` op als de gebruiker admin is, zodat de CalendarItemDialog bewerking volledig werkt.

3. **`isAdmin` en `canEdit` doorgeven aan alle 4 de dialogen**:
   - `DryIceOrderDialog`: voeg `isAdmin={isAdmin}` en `canEdit={permissions.canEditOrders}` toe
   - `GasCylinderOrderDialog`: voeg `isAdmin={isAdmin}` en `canEdit={permissions.canEditOrders}` toe
   - `AmbulanceTripDialog`: wijzig `isAdmin={false}` naar `isAdmin={isAdmin}`
   - `CalendarItemDialog`: voeg `isAdmin={isAdmin}` toe, plus `profiles` en `timeOffTypes` als admin

### Technische details

```text
DailyOverview
  |-- useEffect: getUser() -> userId
  |-- useUserPermissions(userId) -> isAdmin, permissions
  |-- (admin) fetch profiles + timeOffTypes voor dialogen
  |
  |-- DryIceOrderDialog      isAdmin={isAdmin} canEdit={permissions.canEditOrders}
  |-- GasCylinderOrderDialog  isAdmin={isAdmin} canEdit={permissions.canEditOrders}
  |-- AmbulanceTripDialog     isAdmin={isAdmin}
  |-- CalendarItemDialog      isAdmin={isAdmin} profiles={...} timeOffTypes={...}
```

### Bestanden die worden aangepast
- `src/components/dashboard/DailyOverview.tsx`

