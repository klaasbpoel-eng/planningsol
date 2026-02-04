

# Plan: Interne Bestellingen Opslaan in Database

## Huidige Situatie

De pagina "Interne Bestellingen" gebruikt momenteel **hardcoded mock data** (regels 52-74 in InternalOrdersPage.tsx). Wanneer een gebruiker een bestelling plaatst:
- Wordt alleen een PDF gegenereerd
- Worden de orders NIET opgeslagen in de database
- Verdwijnen de orders bij het verversen van de pagina

## Oplossing

We maken twee nieuwe database tabellen aan om interne bestellingen permanent op te slaan, en passen de frontend aan om deze data te lezen en schrijven.

---

## Database Wijzigingen

### Tabel 1: `internal_orders`

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| id | uuid | Primary key |
| order_number | text | Uniek ordernummer (bijv. "INT-20260204-001") |
| from_location | production_location | Verzendlocatie (sol_emmen / sol_tilburg) |
| to_location | production_location | Ontvangstlocatie |
| status | text | pending / shipped / received |
| notes | text | Optionele notities |
| created_by | uuid | Referentie naar profiles.id |
| created_at | timestamptz | Aanmaakdatum |
| updated_at | timestamptz | Laatst bijgewerkt |

### Tabel 2: `internal_order_items`

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| id | uuid | Primary key |
| order_id | uuid | FK naar internal_orders |
| article_id | text | Artikelnummer uit ARTICLES lijst |
| article_name | text | Artikelnaam |
| quantity | integer | Aantal |
| created_at | timestamptz | Aanmaakdatum |

### RLS Policies

- **SELECT**: Gebruikers met elevated roles (admin, supervisor, operator) kunnen orders zien voor hun locatie
- **INSERT**: Alleen admins en supervisors kunnen orders aanmaken
- **UPDATE**: Alleen admins kunnen status updaten
- **DELETE**: Alleen admins kunnen orders verwijderen

---

## Frontend Wijzigingen

### 1. Data Fetching (Nieuw)

Toevoegen van useEffect voor het ophalen van bestaande orders:

```text
- Fetch orders bij component mount
- Filter op productionLocation (inkomend = to_location, uitgaand = from_location)
- Join met internal_order_items voor de artikelen
- Realtime subscriptie voor live updates
```

### 2. Order Aanmaken (Wijzigen)

De `submitOrder` functie wordt aangepast:

```text
1. Genereer ordernummer: INT-YYYYMMDD-XXX
2. Insert in internal_orders tabel
3. Insert items in internal_order_items tabel
4. Refresh orders lijst
5. Genereer PDF (bestaande functionaliteit)
6. Toon success toast
```

### 3. Status Updates (Nieuw)

Knoppen toevoegen voor status wijzigingen:
- "Verzonden" knop (pending -> shipped)
- "Ontvangen" knop (shipped -> received)

---

## Bestanden die Gewijzigd Worden

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| Database migratie | Nieuw | Tabellen en RLS policies aanmaken |
| `src/pages/InternalOrdersPage.tsx` | Wijzigen | Database integratie toevoegen |
| `src/utils/generateOrderPDF.ts` | Wijzigen | Aanpassen voor database order format |

---

## Technische Details

### Ordernummer Generatie

```typescript
const generateOrderNumber = () => {
  const date = format(new Date(), "yyyyMMdd");
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `INT-${date}-${random}`;
};
```

### Database Query Voorbeeld

```typescript
const { data: orders } = await supabase
  .from("internal_orders")
  .select(`
    *,
    items:internal_order_items(*)
  `)
  .or(`to_location.eq.${productionLocation},from_location.eq.${productionLocation}`)
  .order("created_at", { ascending: false });
```

### Insert Flow

```typescript
// 1. Insert order
const { data: order } = await supabase
  .from("internal_orders")
  .insert({
    order_number: generateOrderNumber(),
    from_location: fromLocation,
    to_location: toLocation,
    status: "pending",
    created_by: profileId
  })
  .select()
  .single();

// 2. Insert items
await supabase
  .from("internal_order_items")
  .insert(
    currentOrderItems.map(item => ({
      order_id: order.id,
      article_id: item.articleId,
      article_name: item.articleName,
      quantity: item.quantity
    }))
  );
```

---

## Resultaat

Na implementatie:
- Orders worden permanent opgeslagen in de database
- De orderlijst toont echte data in plaats van mock data
- Orders blijven zichtbaar na page refresh
- Meerdere gebruikers kunnen dezelfde orders zien
- Status kan worden bijgewerkt (pending -> shipped -> received)
- PDF generatie blijft werken

