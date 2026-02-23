-- Create a new toolbox: "Productetikettering — Medicinale & Technische Cilinders"
DO $$
DECLARE
  v_toolbox_id uuid;
  v_base_order integer := 0;
BEGIN
  -- 1. Insert the Toolbox
  INSERT INTO public.toolboxes (
    title,
    description,
    category,
    cover_image_url,
    estimated_duration_minutes,
    is_mandatory,
    status,
    published_at
  ) VALUES (
    'Toolbox Meeting — Productetikettering: Sleeves, Stickers & Barcodes op Medicinale en Technische Cilinders',
    'Alles over correcte etikettering van medicinale cilinders (plastic sleeves) en technische cilinders (productstickers). Barcodestickers, track & trace en kwaliteitseisen.',
    'Kwaliteit',
    'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&q=80&w=2000',
    15,
    true,
    'published',
    now()
  ) RETURNING id INTO v_toolbox_id;

  -- 2. Insert Sections

  -- Sectie 1: Opening
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Waarom etikettering ertoe doet',
    E'**"Elke cilinder die onze hal verlaat is een visitekaartje van ons bedrijf."**\n\nOf het nu een medicinale zuurstofcilinder voor een ziekenhuis is of een technische stikstofcilinder voor een fabriek — de etikettering bepaalt hoe de klant ons product ervaart. En bij medicinale cilinders is het nog veel meer dan dat: het is een **wettelijke verplichting** die de patiënt beschermt.\n\nEen slordige, verkeerde of onleesbare etikettering betekent:\n*   Een **onprofessioneel product** dat niet geleverd mag worden\n*   Mogelijke **afkeur bij kwaliteitscontrole** — en dus herwerk voor jou\n*   Problemen bij **track & trace** als de barcode niet scanbaar is\n*   Bij medicinale cilinders: **wettelijke overtredingen** en gevaar voor de patiënt\n\n**Jij bent de laatste schakel vóór de klant.** Wat jij aflevert, vertegenwoordigt het hele bedrijf. In deze toolbox behandelen we zowel **medicinale** als **technische** cilinders — want bij beide geldt: kwaliteit begint bij jou.',
    v_base_order + 1
  );

  -- Sectie 2: Afbeelding
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'image',
    'Medicinale sleeve vs. technische sticker',
    'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&q=80&w=2000',
    v_base_order + 2
  );

  -- Sectie 3: Twee werelden — medicinaal vs. technisch
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Twee werelden: medicinale en technische cilinders',
    E'We werken met twee typen cilinders die elk hun eigen etikettering hebben. Het is belangrijk dat je het verschil kent.\n\n**MEDICINALE EIGENDOMSCILINDERS (zuurstof & lucht)**\nMedicinale zuurstof- en luchtcilinders krijgen **geen productsticker**, maar een **plastic sleeve (krimpkous)**. Dit is een bedrukte kunststof huls die om de cilinder wordt geschoven en met een **föhn wordt gekrompen** zodat deze strak om de cilinder zit.\n\n*   De sleeve bevat alle **wettelijk verplichte productinformatie**: productnaam, gassoort, concentratie, farmaceutisch registratienummer, fabrikant\n*   De sleeve is **professioneler en duurzamer** dan een sticker — hij laat niet los en kan niet scheef zitten\n*   Een beschadigde, gescheurde of onleesbare sleeve betekent: **cilinder mag NIET worden uitgeleverd**\n*   De sleeve wordt aangevuld met **barcodestickers** voor track & trace en **batchstickers** voor traceerbaarheid\n\n**TECHNISCHE CILINDERS (alle overige gassen)**\nTechnische cilinders krijgen een traditionele **productsticker (etiket)** met productinformatie.\n\n*   Bevat: productnaam, gassoort, concentratie, gevarenidentificatie (GHS/CLP), veiligheidsblad-verwijzing\n*   Moet **recht, leesbaar en onbeschadigd** zijn\n*   Wordt aangevuld met **barcodestickers** voor track & trace en **batchstickers**\n*   Bij technische cilinders gelden de **CLP-verordening** en de **PGS 9-richtlijnen** voor etikettering',
    v_base_order + 3
  );

  -- Sectie 4: De plastic sleeve — medicinale cilinders
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'De plastic sleeve: productinformatie op medicinale cilinders',
    E'De sleeve is het **hoofdetiket** van een medicinale zuurstof- of luchtcilinder. Hier moet je alles over weten.\n\n**Wat staat er op de sleeve?**\n*   Productnaam (bijv. "Medicinale Zuurstof 100%")\n*   Gassoort en concentratie\n*   Farmaceutisch registratienummer (RVG/EU-nummer)\n*   Naam en adres van de fabrikant / vergunninghouder\n*   Chargenummer (batchnummer) — soms als aparte sticker\n*   Houdbaarheidsdatum\n*   Bewaar- en gebruiksaanwijzingen\n*   Gevaarsymbolen en waarschuwingen\n\n**Hoe breng je een sleeve correct aan?**\n1.  Controleer of de cilinder **schoon, droog en vrij van oude sleefresten** is\n2.  Schuif de sleeve over de cilinder tot de **juiste positie** — tekst moet leesbaar en recht staan\n3.  Gebruik de **föhn** om de sleeve gelijkmatig te krimpen — begin vanuit het midden naar de randen\n4.  Föhn **gelijkmatig** — niet te lang op één plek (voorkomt verbranding/bubbels)\n5.  Controleer na het föhnen: zit de sleeve **strak, zonder kreukels of luchtbubbels**?\n6.  Is alle tekst **leesbaar en niet vervormd** door het krimpproces?\n\n**Veelvoorkomende problemen:**\n*   ❌ Sleeve scheef geschoven → tekst staat niet recht, ziet er slordig uit\n*   ❌ Sleeve niet volledig gekrompen → zit los, kan verschuiven of scheuren\n*   ❌ Te lang geföhnd op één plek → verbranding, witte plekken, onleesbare tekst\n*   ❌ Sleeve over beschadigde of vuile cilinder → hecht niet goed, bubbels onder de sleeve\n*   ❌ Oude sleefresten niet verwijderd → bobbels en ongelijkmatig resultaat\n\n*"Een goed geplaatste sleeve is het verschil tussen een professioneel farmaceutisch product en een afgekeurd exemplaar."*',
    v_base_order + 4
  );

  -- Sectie 5: Productstickers — technische cilinders
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Productstickers op technische cilinders',
    E'Technische cilinders krijgen een **productsticker** als hoofdetiket. De eisen zijn anders dan bij medicinale cilinders, maar het belang van een nette, correcte sticker is hetzelfde.\n\n**Wat staat er op de technische productsticker?**\n*   Productnaam en gassoort (bijv. "Stikstof 5.0", "Acetyleen", "Argon")\n*   Concentratie/zuiverheid\n*   **GHS/CLP-gevaarsymbolen** (bijv. ontvlambaar, onder druk, oxiderend)\n*   Signaalwoord (GEVAAR of WAARSCHUWING)\n*   H- en P-zinnen (gevaren- en voorzorgsmaatregelen)\n*   Verwijzing naar het Veiligheidsinformatieblad (VIB/SDS)\n*   Naam en contactgegevens van de leverancier\n*   Nominale inhoud en druk\n\n**Waarom is dit belangrijk?**\n*   De **CLP-verordening** (EU) schrijft voor welke informatie op het etiket moet staan\n*   Een cilinder zonder correct etiket mag **niet worden vervoerd of geleverd** (ADR-regelgeving)\n*   De eindgebruiker moet kunnen aflezen welk gas erin zit en welke gevaren erbij horen\n*   Bij een incident moet hulpverlening direct kunnen zien wat er in de cilinder zit\n\n**Hoe plak je de sticker correct?**\n*   Oppervlak **schoon en droog**\n*   Sticker **recht** en op de aangewezen positie plakken\n*   Volledig **aandrukken** — geen bubbels of kreukels\n*   Productsticker moet zichtbaar zijn wanneer de cilinder in het rek of de krat staat\n*   Bij beschadiging: oude sticker **volledig verwijderen** en nieuwe aanbrengen\n\n*"Een technische cilinder zonder leesbaar etiket is net zo onacceptabel als een medicinale cilinder zonder sleeve."*',
    v_base_order + 5
  );

  -- Sectie 6: Barcode & Track & Trace (beide typen)
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Barcode & track & trace: geldt voor alle cilinders',
    E'Of het nu een medicinale of technische cilinder is — **elke cilinder krijgt een barcodesticker**. De barcode is de digitale identiteit van de cilinder.\n\n**Zonder scanbare barcode kan de cilinder niet:**\n*   Ingeboekt worden in het systeem\n*   Gekoppeld worden aan een batch en vuldatum\n*   Vrijgegeven worden voor levering\n*   Getraceerd worden bij een klacht of recall\n\n**Batchsticker / vulsticker**\nNaast de barcode krijgt elke cilinder een batchsticker met:\n*   Batchnummer\n*   Vuldatum\n*   Houdbaarheidsdatum (met name bij medicinale cilinders)\n*   Deze informatie moet **overeenkomen** met wat er in het systeem staat\n\n**Waar plak je de barcode?**\n*   Op een **vlak, ononderbroken deel** van de cilinder\n*   **Niet** over een las, knik, of (bij medicinale cilinders) over de sleeve\n*   Op een plek die **makkelijk bereikbaar** is voor de scanner\n\n**Veelvoorkomende problemen:**\n*   Barcode over een **las of knik** geplakt → scanner kan hem niet lezen\n*   Barcode **beschadigd** door handling of stoten\n*   **Verkeerde barcode** op verkeerde cilinder → hele batch in gevaar\n*   Barcode op een **vuil of vet oppervlak** → laat los tijdens transport\n\n**De gouden regel:**\n*"Test de barcode ALTIJD met de scanner vóór vrijgave. Geen scan = geen levering."*',
    v_base_order + 6
  );

  -- Sectie 7: Wettelijk kader
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Wettelijk kader: waarom is dit zo streng?',
    E'Etikettering is niet zomaar een bedrijfsregel — het is **wettelijk verplicht** voor zowel medicinale als technische gassen.\n\n**MEDICINALE GASSEN**\n*   Vallen onder de **Geneesmiddelenwet** en **EU GMP-richtlijnen** (Good Manufacturing Practice)\n*   Toezicht door de **Inspectie Gezondheidszorg en Jeugd (IGJ)**\n*   De sleeve is een **farmaceutisch etiket** — dezelfde regels als voor medicijnen in de apotheek\n*   Fouten kunnen leiden tot: recalls, boetes, verlies van fabricagevergunning, gevaar voor patiënten\n\n**TECHNISCHE GASSEN**\n*   Vallen onder de **CLP-verordening** (Classification, Labelling and Packaging) van de EU\n*   Transportetikettering conform **ADR** (vervoer gevaarlijke stoffen over de weg)\n*   Opslageisen conform **PGS 9** (Publicatiereeks Gevaarlijke Stoffen)\n*   Fouten kunnen leiden tot: transportverbod, boetes van IL&T (Inspectie Leefomgeving en Transport), onveilige situaties bij de klant\n\n**Voor beide geldt:**\n*   Elke cilinder moet **volledig traceerbaar** zijn van productie tot eindgebruiker\n*   De etikettering maakt die traceerbaarheid mogelijk\n*   Bij een incident of klacht moet de hele keten terug te volgen zijn\n\n*"Dit is geen bureaucratie — het beschermt de patiënt, de klant, en het bedrijf."*',
    v_base_order + 7
  );

  -- Sectie 8: Correct aanbrengen — samenvatting beide methoden
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Correct aanbrengen: sleeve vs. sticker',
    E'**MEDICINALE SLEEVE — Stap voor stap**\n1.  Cilinder moet **schoon, droog en vrij van oude sleefresten** zijn\n2.  Schuif de sleeve op de juiste positie — tekst recht en leesbaar\n3.  Föhn **gelijkmatig vanuit het midden** naar de randen\n4.  Niet te lang op één plek — voorkom verbranding en witte plekken\n5.  Controleer: strak, geen kreukels, alle tekst leesbaar\n6.  Breng vervolgens de **barcodesticker** en **batchsticker** aan\n7.  Test de barcode met de scanner\n\n**TECHNISCHE PRODUCTSTICKER — Stap voor stap**\n1.  Oppervlak **schoon en droog** — geen vet, vuil of condensvocht\n2.  Verwijder oude of beschadigde stickers **volledig**\n3.  Sticker **recht** en op de aangewezen positie plakken\n4.  In **één keer goed** aanbrengen — geen bubbels of kreukels\n5.  Breng vervolgens de **barcodesticker** en **batchsticker** aan\n6.  Test de barcode met de scanner\n7.  Controleer: gassoort op sticker = kleurcodering cilinderschouder\n\n**BARCODESTICKER — Voor beide typen**\n1.  Plak op een **vlak, glad deel** — niet over las, knik of sleeve\n2.  Volledig aandrukken\n3.  **Altijd testen met de scanner** vóór vrijgave\n\nBij twijfel over het resultaat: **niet accepteren**. Nieuwe sleeve of sticker pakken.',
    v_base_order + 8
  );

  -- Sectie 9: Checklist medicinale cilinders
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Checklist: Medicinale cilinders (sleeve)',
    '[
      {"text": "Cilinder is schoon, droog en vrij van oude sleefresten"},
      {"text": "Sleeve correct gepositioneerd — tekst recht en op de juiste hoogte"},
      {"text": "Sleeve gelijkmatig gekrompen met föhn — geen kreukels, bubbels of verbranding"},
      {"text": "Alle tekst op de sleeve is leesbaar en niet vervormd"},
      {"text": "Barcodesticker aangebracht op vlak oppervlak (niet over de sleeve)"},
      {"text": "Barcode 100% scanbaar getest met scanner"},
      {"text": "Batchnummer en houdbaarheidsdatum correct en leesbaar"},
      {"text": "Gassoort op sleeve komt overeen met kleurcodering cilinderschouder"},
      {"text": "Bij beschadigde of onleesbare sleeve: cilinder NIET vrijgegeven"}
    ]',
    v_base_order + 9
  );

  -- Sectie 10: Checklist technische cilinders
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Checklist: Technische cilinders (sticker)',
    '[
      {"text": "Cilinderoppervlak schoon en droog vóór het plakken"},
      {"text": "Oude of beschadigde stickers volledig verwijderd"},
      {"text": "Productsticker recht geplakt, zonder bubbels of kreukels"},
      {"text": "Productsticker leesbaar — gassoort, concentratie, GHS-symbolen zichtbaar"},
      {"text": "Gassoort op sticker komt overeen met kleurcodering cilinderschouder"},
      {"text": "Barcodesticker aangebracht op vlak oppervlak"},
      {"text": "Barcode 100% scanbaar getest met scanner"},
      {"text": "Batchnummer en vuldatum correct en leesbaar"},
      {"text": "Geen oude stickers zichtbaar onder of naast de nieuwe sticker"},
      {"text": "Bij twijfel over leesbaarheid: nieuwe sticker aangebracht"}
    ]',
    v_base_order + 10
  );

  -- Sectie 11: Veelgemaakte fouten
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Top fouten die we willen voorkomen',
    E'**FOUTEN BIJ MEDICINALE SLEEVES**\n\n**1. Sleeve scheef of verdraaid aangebracht**\nTekst staat schuin, ziet er onprofessioneel uit, kan bij inspectie worden afgekeurd.\n→ Neem de tijd bij het positioneren vóór het föhnen.\n\n**2. Ongelijkmatig geföhnd**\nTe lang op één plek → witte verbranding, onleesbare tekst. Te kort → sleeve zit los en kan verschuiven.\n→ Gelijkmatig bewegen, vanuit het midden naar de randen.\n\n**3. Oude sleefresten niet verwijderd**\nNieuwe sleeve over restanten → bobbels, ongelijkmatig resultaat, slordig product.\n→ Altijd eerst volledig verwijderen en het oppervlak reinigen.\n\n**4. Beschadigde sleeve toch laten zitten**\nEen scheur of gat in de sleeve = onacceptabel. De cilinder mag niet worden uitgeleverd.\n→ Sleeve vervangen. Geen tape of reparatiepogingen.\n\n---\n\n**FOUTEN BIJ TECHNISCHE STICKERS**\n\n**5. Overstickeren**\nNieuwe sticker over een oude plakken. Resultaat: dikke, bobbelige laag die loslaat.\n→ Oude sticker altijd volledig verwijderen.\n\n**6. Scheef plakken**\n"Zit er toch op" — maar het ziet er onprofessioneel uit en GHS-symbolen kunnen onleesbaar worden.\n→ Eén keer goed is sneller dan twee keer opnieuw.\n\n**7. Verkeerde sticker op verkeerde cilinder**\nBij medicinaal: gevaar voor de patiënt en recall. Bij technisch: verkeerde gevaarsymbolen, gevaar voor de gebruiker.\n→ Controleer altijd gassoort + cilindernummer vóór het plakken/schuiven.\n\n---\n\n**FOUTEN BIJ BARCODES (beide typen)**\n\n**8. Barcode niet testen**\nErvan uitgaan dat de barcode wel werkt. Bij de volgende stap: stilstand.\n→ Scan de barcode ALTIJD voordat de cilinder verder gaat.\n\n**9. Barcode op verkeerde plek**\nOver een las, knik of over de sleeve geplakt → niet scanbaar.\n→ Altijd op een vlak, glad oppervlak plakken.',
    v_base_order + 11
  );

  -- Sectie 12: Procedure bij fouten
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Procedure bij etiketteringsfouten',
    E'Fouten gebeuren. Het gaat erom hoe je ermee omgaat.\n\n**Fout ontdekt VÓÓR vrijgave:**\n1.  Verwijder de foutieve sticker of beschadigde sleeve volledig\n2.  Reinig het oppervlak\n3.  Breng een correcte nieuwe sleeve/sticker aan\n4.  Documenteer de correctie conform het kwaliteitssysteem\n\n**Fout ontdekt NÁ vrijgave:**\n1.  Meld **direct** bij de leidinggevende en/of kwaliteitsafdeling\n2.  Cilinder **blokkeren/terughalen** indien mogelijk\n3.  Batchbeoordeling: zijn er meer cilinders met dezelfde fout?\n4.  Afwijkingsrapport (deviation) opmaken\n5.  Bij medicinale cilinders: **IGJ-meldingsprocedure** volgen indien nodig\n\n**Bij twijfel: ALTIJD melden.**\nLiever een onterechte melding dan een gemiste fout die bij de patiënt of klant terechtkomt.\n\n*"Een fout melden is geen zwakte — het is vakmanschap. Wegkijken is het echte probleem."*',
    v_base_order + 12
  );

  -- Sectie 13: Het belang voor jouw werk
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Goede etikettering = makkelijker werken',
    E'Correct etiketteren is niet alleen een verplichting — het maakt jouw werk ook makkelijker.\n\n*   **Nette sleeves en stickers** → minder afgekeurde cilinders → **minder herwerk**\n*   **Scanbare barcodes** → snellere verwerking in het systeem → **minder wachttijd**\n*   **Correcte labels** → geen recalls → **geen extra administratie en stress**\n*   **Professioneel product** → trots op je werk → **tevreden klanten**\n\nElke cilinder die de deur uitgaat met een correcte, nette etikettering is er eentje die **niet terugkomt** voor herwerk. Dat bespaart jou tijd en frustratie.\n\nDe klant — of dat nu een ziekenhuis, een ambulancedienst, een fabriek of een lasser is — vertrouwt erop dat wat er op de cilinder staat, klopt. Dat vertrouwen begint bij jou.\n\n*"Een net product begint bij jou aan de vullijn — medicinaal én technisch."*',
    v_base_order + 13
  );

  -- Sectie 14: Quiz
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'quiz',
    'Test je kennis: Etikettering medicinaal & technisch',
    '[
      {
        "question": "Hoe wordt de productinformatie aangebracht op medicinale zuurstof- en luchtcilinders?",
        "options": ["Met een gewone productsticker", "Met een plastic sleeve (krimpkous) die eromheen wordt geföhnd", "Met een gravering in het metaal", "Met een krijtmarkering"],
        "correct": 1
      },
      {
        "question": "Wat moet je altijd doen na het plakken van een barcodesticker?",
        "options": ["De sticker extra aandrukken met een doek", "De barcode testen met de scanner", "Een foto maken voor de administratie", "De cilinder 10 minuten laten drogen"],
        "correct": 1
      },
      {
        "question": "Onder welke wet vallen medicinale gassen?",
        "options": ["De Arbowet", "De Geneesmiddelenwet", "De Warenwet", "De Mijnbouwwet"],
        "correct": 1
      },
      {
        "question": "Welke gevarensymbolen moeten op technische cilinderetiketten staan?",
        "options": ["Geen, technische gassen zijn niet gevaarlijk", "GHS/CLP-gevaarsymbolen conform de CLP-verordening", "Alleen een doodskop", "Dat bepaalt de klant zelf"],
        "correct": 1
      },
      {
        "question": "Wat doe je als een medicinale sleeve beschadigd of gescheurd is?",
        "options": ["Met tape repareren", "Sleeve vervangen — de cilinder mag niet worden uitgeleverd", "Niets, een kleine scheur maakt niet uit", "Er een sticker overheen plakken"],
        "correct": 1
      },
      {
        "question": "Mag je een nieuwe productsticker over een oude plakken op een technische cilinder?",
        "options": ["Ja, dat bespaart tijd", "Ja, als de oude sticker nog goed zit", "Nee, tenzij de procedure dit expliciet toestaat", "Nee, want stickers zijn te duur om dubbel te gebruiken"],
        "correct": 2
      },
      {
        "question": "Waarom moet je bij het föhnen van een sleeve gelijkmatig bewegen?",
        "options": ["Anders duurt het te lang", "Om verbranding, witte plekken en onleesbare tekst te voorkomen", "Dat is alleen voor de uitstraling", "Dat hoeft niet, je kunt het in één keer doen"],
        "correct": 1
      },
      {
        "question": "Wat doe je als je ontdekt dat een vrijgegeven cilinder een verkeerde sticker/sleeve heeft?",
        "options": ["Niets, het is al verzonden", "Direct melden bij leidinggevende of kwaliteitsafdeling", "Zelf een nieuwe sticker plakken bij de volgende ronde", "De klant bellen"],
        "correct": 1
      },
      {
        "question": "Wat is het voordeel van correcte etikettering voor jou als operator?",
        "options": ["Minder herwerk, snellere verwerking en minder afgekeurde cilinders", "Je krijgt een bonus", "De scanner maakt een leuk geluid", "Er is geen voordeel, het is alleen voor de administratie"],
        "correct": 0
      }
    ]',
    v_base_order + 14
  );

  -- Sectie 15: Afsluiting
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Samenvatting & afronding',
    E'**Onthoud deze kernpunten:**\n\n**Medicinale cilinders (zuurstof & lucht):**\n*   Krijgen een **plastic sleeve** — geen productsticker\n*   De sleeve wordt om de cilinder **geföhnd** en bevat alle farmaceutische productinformatie\n*   Een beschadigde sleeve = cilinder **niet uitleveren**\n\n**Technische cilinders:**\n*   Krijgen een **productsticker** met gassoort, GHS-symbolen en veiligheidsinformatie\n*   Sticker moet recht, leesbaar en compleet zijn\n\n**Voor alle cilinders:**\n*   Barcodesticker altijd **testen met de scanner** vóór vrijgave\n*   Bij twijfel: **nieuwe sleeve/sticker** pakken\n*   Bij fouten: **altijd melden** — liever een keer te veel dan een keer te weinig\n*   Goed etiketteren bespaart jou herwerk en frustratie\n\n*"Jij maakt het verschil tussen een goed product en een afgekeurd product — medicinaal én technisch. Wees trots op wat je aflevert."*\n\nHeb je vragen of opmerkingen? Bespreek ze met je leidinggevende of de kwaliteitsafdeling.',
    v_base_order + 15
  );

END $$;
