

# Alle Verbeteringen Implementeren

## Overzicht
Dit plan implementeert alle eerder voorgestelde verbeteringen in 5 stappen, geordend op impact en afhankelijkheden.

---

## 1. ProtectedRoute Component (DRY auth-logica)

Elke pagina (CalendarPage, ProductionPlanningPage, DashboardPage, InternalOrdersPage, ToolboxPage) bevat dezelfde auth-check logica: sessie ophalen, user state bijhouden, redirect naar "/" als niet ingelogd, en een laad-spinner tonen. Dit wordt gecentraliseerd in een herbruikbaar `ProtectedRoute` component.

**Wat verandert:**
- Nieuw bestand: `src/components/auth/ProtectedRoute.tsx`
- Bevat auth state management, redirect, en loading spinner
- Geeft `user`, `role`, `permissions`, `productionLocation`, `canViewAllLocations` door aan child-pagina's via render prop of context
- Alle 5 pagina's worden vereenvoudigd: auth-logica wordt verwijderd

**Technisch detail:**
```text
ProtectedRoute
  +-- useEffect: onAuthStateChange + getSession
  +-- useUserPermissions(user?.id)
  +-- Loading? -> Spinner
  +-- No user? -> Navigate to "/"
  +-- Authenticated? -> Render children met user/permissions props
```

---

## 2. Consistente PageLayout Component

Pagina's gebruiken inconsistente padding (`px-[1%] md:px-[10%]` vs `container mx-auto px-4`). Een gedeelde `PageLayout` component zorgt voor consistentie.

**Wat verandert:**
- Nieuw bestand: `src/components/layout/PageLayout.tsx`
- Bevat: Header, consistente padding (`container mx-auto px-4 py-8`), optionele page title/description, en breadcrumbs
- Alle pagina's gebruiken deze layout in plaats van hun eigen Header + padding wrapper

---

## 3. Wachtwoord Vergeten Functie

Het loginformulier mist een "Wachtwoord vergeten" optie, wat een standaard verwachting is.

**Wat verandert:**
- `src/components/auth/AuthForm.tsx`: nieuwe state `isForgotPassword`
- Bij activering: toont alleen e-mailveld + "Reset link versturen" knop
- Gebruikt `supabase.auth.resetPasswordForEmail()` met `redirectTo: window.location.origin`
- Terugknop naar login

---

## 4. Error Boundary Component

Onverwachte fouten geven nu een wit scherm. Een Error Boundary vangt crashes op en toont een nette foutmelding.

**Wat verandert:**
- Nieuw bestand: `src/components/ui/error-boundary.tsx`
- Class component met `componentDidCatch` en `getDerivedStateFromError`
- Toont een nette foutpagina met "Opnieuw proberen" knop
- Wordt toegevoegd in `App.tsx` rond de Routes

---

## 5. Code Cleanup

Diverse kleine fixes die de codekwaliteit verbeteren.

**Wat verandert:**
- `src/App.css`: Verwijder ongebruikte Vite boilerplate CSS (het hele bestand kan worden leeggemaakt, de relevante styling zit in `index.css`)
- `src/components/dashboard/UserLaunchpad.tsx`: Fix incorrecte import `import Link from "react-router-dom"` (regel 6) -- wordt niet gebruikt, kan verwijderd worden
- `src/pages/ToolboxPage.tsx`: Vervang `window.confirm()` (regel 127) door een `AlertDialog` component voor een consistente, toegankelijke bevestigingsdialoog
- `src/components/layout/Header.tsx`: Voeg een "Skip to main content" link toe bovenaan voor WCAG-toegankelijkheid

---

## Samenvatting van nieuwe/gewijzigde bestanden

| Bestand | Actie |
|---|---|
| `src/components/auth/ProtectedRoute.tsx` | Nieuw |
| `src/components/layout/PageLayout.tsx` | Nieuw |
| `src/components/ui/error-boundary.tsx` | Nieuw |
| `src/components/auth/AuthForm.tsx` | Wachtwoord vergeten toevoegen |
| `src/App.tsx` | Error Boundary toevoegen, routes wrappen met ProtectedRoute |
| `src/App.css` | Boilerplate verwijderen |
| `src/pages/CalendarPage.tsx` | Vereenvoudigen met ProtectedRoute + PageLayout |
| `src/pages/ProductionPlanningPage.tsx` | Vereenvoudigen met ProtectedRoute + PageLayout |
| `src/pages/DashboardPage.tsx` | Vereenvoudigen met ProtectedRoute + PageLayout |
| `src/pages/InternalOrdersPage.tsx` | Vereenvoudigen met ProtectedRoute + PageLayout |
| `src/pages/ToolboxPage.tsx` | Vereenvoudigen + AlertDialog i.p.v. confirm() |
| `src/components/dashboard/UserLaunchpad.tsx` | Fix incorrecte import |
| `src/components/layout/Header.tsx` | Skip-to-content link |

