
# Plan: Klantbeheer integreren in Admin Instellingen

## Overzicht
De klantenbeheer functionaliteit wordt verplaatst naar de Admin Instellingen pagina. Het aparte menu-item "Klanten" en de bijbehorende pagina worden verwijderd, zodat alles gecentraliseerd is op één plek.

## Wijzigingen

### 1. Admin Instellingen uitbreiden
Een nieuwe sectie "Klantenbeheer" toevoegen aan de AdminSettings component die de bestaande CustomerManagement component hergebruikt.

**Bestand:** `src/components/admin/AdminSettings.tsx`
- Import CustomerManagement component toevoegen
- CustomerManagement component toevoegen aan de sectie-indeling

### 2. Menu-item verwijderen
Het "Klanten" menu-item uit de navigatie header verwijderen.

**Bestand:** `src/components/layout/Header.tsx`
- De Link naar `/klanten` verwijderen (regels 84-91)
- De `Building2` icon import kan behouden blijven (wordt mogelijk elders gebruikt)

### 3. Route verwijderen
De `/klanten` route uit de applicatie verwijderen.

**Bestand:** `src/App.tsx`
- De import van CustomersPage verwijderen
- De Route voor `/klanten` verwijderen

### 4. Pagina verwijderen (optioneel)
Het CustomersPage bestand kan worden verwijderd omdat het niet meer wordt gebruikt.

**Bestand:** `src/pages/CustomersPage.tsx`
- Dit bestand kan worden verwijderd

---

## Technische Details

### AdminSettings.tsx aanpassing
```text
Huidige structuur:
- UserApprovalManagement
- CategoryManagement
- LeaveTypeManagement
- GasCylinderSettings
- DryIceSettings
- DefaultCustomerSetting

Nieuwe structuur:
- UserApprovalManagement
- CategoryManagement
- LeaveTypeManagement
- GasCylinderSettings
- DryIceSettings
- DefaultCustomerSetting
- CustomerManagement (nieuw)
```

### Header.tsx aanpassing
De volgende code wordt verwijderd:
```text
{role === "admin" && (
  <Link to="/klanten">
    <Button variant="ghost" size="sm" ...>
      <Building2 className="h-4 w-4 mr-2" />
      <span className="hidden sm:inline">Klanten</span>
    </Button>
  </Link>
)}
```

### App.tsx aanpassing
De volgende worden verwijderd:
- `import CustomersPage from "./pages/CustomersPage";`
- `<Route path="/klanten" element={<CustomersPage />} />`

---

## Resultaat
Na implementatie:
- Admin gebruikers beheren klanten rechtstreeks vanuit de Admin Instellingen pagina
- De navigatie is vereenvoudigd met één menu-item minder
- Alle beheersfuncties zijn gecentraliseerd op één plek
