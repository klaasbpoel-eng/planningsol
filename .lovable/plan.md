

# Ambulance klanten zichtbaar op homepage

## Probleem

De `ambulance_trip_customers` tabel heeft geen foreign key constraint op `trip_id` naar `ambulance_trips.id`. Hierdoor werkt de geneste select (`ambulance_trip_customers(customer_name, customer_number)`) niet en worden klanten als lege array (`[]`) teruggegeven -- zowel op de homepage (DailyOverview) als in de kalender.

## Oplossing

### Stap 1: Database migratie -- Foreign Key toevoegen

Een migratie uitvoeren die de ontbrekende FK toevoegt:

```sql
ALTER TABLE public.ambulance_trip_customers
  ADD CONSTRAINT ambulance_trip_customers_trip_id_fkey
  FOREIGN KEY (trip_id) REFERENCES public.ambulance_trips(id) ON DELETE CASCADE;
```

### Stap 2: Verificatie

Na de migratie zullen de bestaande queries in zowel `DailyOverview.tsx` als `CalendarOverview.tsx` automatisch correct werken. Er zijn geen code-wijzigingen nodig -- de rendering-logica voor cilinders en klanten is al aanwezig.

## Impact

- De DailyOverview op de homepage toont cilinder-details en klantnamen bij ambulanceritten
- De kalenderweergave toont dezelfde klantinformatie
- Het AmbulanceTripDialog kan klanten correct laden voor bewerken/verwijderen
