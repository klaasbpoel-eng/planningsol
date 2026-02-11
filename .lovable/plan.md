
## Snel Bestellen voor Klanten

### Overzicht

Een compleet klantbestelportaal waar klanten zelf inloggen en alleen hun eigen assortiment zien en kunnen bestellen. Dit bestaat uit drie onderdelen:

1. **Database-aanpassingen**: Klanten koppelen aan gebruikersaccounts + RLS policies
2. **Admin: Assortimentbeheer**: Pagina waar admins producten aan klanten koppelen
3. **Klantportaal: Snel Bestellen**: Bestelformulier waar klanten hun producten zien en bestellen

---

### Stap 1: Database-aanpassingen

**Nieuwe tabel: `customer_users`**
Koppelt een Supabase auth-gebruiker aan een klant:
- `user_id` (uuid, verwijst naar auth.users)
- `customer_id` (uuid, verwijst naar customers)

Dit maakt het mogelijk dat een klant inlogt en automatisch zijn assortiment ziet.

**Nieuwe `app_role` waarde: `customer`**
Toevoegen aan de bestaande `app_role` enum zodat klanten een eigen rol krijgen en niet als 'user' worden behandeld.

**RLS policies voor `customer_products`**
- Klanten mogen alleen hun eigen assortiment zien (via `customer_users` koppeling)
- Admins hebben volledige toegang

**RLS policies voor `orders` en `order_items`**
- Klanten mogen orders aanmaken voor hun eigen klant-account
- Klanten mogen hun eigen orders inzien

**RLS policy updates voor `products`**
- Klanten mogen actieve producten lezen (nodig voor assortiment-weergave)

---

### Stap 2: Admin - Assortimentbeheer

**Nieuw component: `CustomerAssortmentManager`**

Wordt toegevoegd aan het bestaande admin-gedeelte. Per klant kun je:
- Producten zoeken en toevoegen aan het assortiment (via `customer_products` tabel)
- Producten verwijderen uit het assortiment
- Het huidige assortiment bekijken, gegroepeerd per categorie

De admin selecteert een klant, ziet het huidige assortiment, en kan producten toevoegen/verwijderen met een zoekbare select.

---

### Stap 3: Klantportaal - Snel Bestellen

**Nieuwe pagina: `/bestellen`**

Wanneer een klant inlogt, komt deze op een bestelformulier:
- Toont alleen producten uit het eigen assortiment (via `customer_products`)
- Producten gegroepeerd per categorie met zoekfunctie
- Per product een hoeveelheid-invoer (+/- knoppen)
- Winkelwagen-overzicht met totalen
- Optioneel notities-veld en gewenste leverdatum
- Bevestig-knop die een `orders` + `order_items` record aanmaakt
- Na bestelling: bevestigingsmelding met ordernummer

**Nieuwe pagina: `/mijn-bestellingen`**

Overzicht van eerdere bestellingen van de klant:
- Ordernummer, datum, status, aantal items
- Klik om details te bekijken

---

### Stap 4: Navigatie en routing

- Klanten zien een aparte navigatie: "Bestellen" en "Mijn Bestellingen"
- Medewerkers (operators/admins) zien de bestaande navigatie
- Route `/bestellen` en `/mijn-bestellingen` toevoegen aan `App.tsx`

---

### Bestanden overzicht

| Bestand | Actie |
|---------|-------|
| Migratie SQL | Nieuw: `customer_users` tabel, `customer` role, RLS policies |
| `src/pages/CustomerOrderPage.tsx` | Nieuw: Snel Bestellen pagina |
| `src/pages/CustomerOrderHistoryPage.tsx` | Nieuw: Mijn Bestellingen pagina |
| `src/components/customer-portal/QuickOrderForm.tsx` | Nieuw: Bestelformulier component |
| `src/components/customer-portal/OrderHistory.tsx` | Nieuw: Bestelgeschiedenis component |
| `src/components/admin/CustomerAssortmentManager.tsx` | Nieuw: Admin assortimentbeheer |
| `src/hooks/useCustomerPortal.ts` | Nieuw: Hook voor klant-data en bestelfunctionaliteit |
| `src/App.tsx` | Aangepast: Nieuwe routes |
| `src/components/layout/Header.tsx` | Aangepast: Klant-specifieke navigatie |

### Technische details

**customer_users tabel:**
```sql
CREATE TABLE public.customer_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
```

**Klant-assortiment ophalen (in hook):**
```typescript
const { data } = await supabase
  .from("customer_products")
  .select("*, product:products(*)")
  .eq("customer_id", customerUser.customer_id);
```

**Order aanmaken (in hook):**
```typescript
// 1. Insert order
const { data: order } = await supabase.from("orders").insert({
  order_number: generateOrderNumber(),
  customer_id: customerUser.customer_id,
  customer_name: customerUser.customer_name,
  created_by: profileId,
  delivery_date: selectedDate,
  notes
}).select().single();

// 2. Insert items
await supabase.from("order_items").insert(
  items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    article_code: item.article_code,
    product_name: item.product_name,
    quantity: item.quantity
  }))
);
```
