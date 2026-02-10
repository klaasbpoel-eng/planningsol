
## Fix: Dubbele klanten in Top 5 Widget

### Oorzaak

De database bevat orders voor dezelfde klant (bijv. "SOL") met verschillende `customer_id` waarden -- sommige orders hebben `customer_id = NULL`, andere hebben een echte UUID. De RPC functies groeperen op **zowel** `customer_id` als `customer_name`, waardoor dezelfde klantnaam als twee aparte rijen verschijnt.

Bewijs uit de database:
- "SOL" met `customer_id = NULL`: 1.165 cilinders
- "SOL" met `customer_id = 7384e...`: 175 cilinders
- Hetzelfde geldt voor "HWTS" en "Vries Gassenhandel"

### Oplossing

Beide RPC functies aanpassen zodat ze groeperen op **alleen `customer_name`**, en de eerste niet-null `customer_id` selecteren via `MAX()`. Dit combineert orders van dezelfde klant ongeacht of ze een `customer_id` hebben.

### Wijzigingen

**Nieuwe database migratie** -- twee functies worden herschreven:

**1. `get_customer_totals_by_period`**
- `GROUP BY customer_name` in plaats van `GROUP BY customer_id, customer_name`
- `MAX(customer_id)` om een representatieve ID terug te geven
- `FULL OUTER JOIN` op `customer_name` in plaats van `customer_id`

**2. `get_yearly_totals_by_customer`**
- Zelfde aanpassing: groepeer op `customer_name`
- `MAX(customer_id)` voor de ID
- `GROUP BY c.cname` in de combined CTE

### Verwacht resultaat

"SOL" verschijnt eenmaal met 1.340 cilinders (1.165 + 175) in plaats van twee keer.

### Technische details

```sql
-- Voorbeeld van de fix in get_customer_totals_by_period:
-- Was:  GROUP BY gco.customer_id, gco.customer_name
-- Wordt: GROUP BY gco.customer_name
-- customer_id wordt: MAX(gco.customer_id)
```

| Bestand | Wijziging |
|---------|-----------|
| Nieuwe SQL migratie | Herschrijf beide RPC functies met `GROUP BY customer_name` |

Geen frontend-wijzigingen nodig -- de widget werkt correct zodra de database de juiste geaggregeerde data teruggeeft.
