-- Create a new toolbox: "Productstickers & Medicinale Stickers op Medische Eigendomscilinders"
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
    'Toolbox Meeting — Productstickers & Medicinale Stickers op Medische Eigendomscilinders',
    'Leer het belang van correcte, nette en leesbare stickers op medicinale eigendomscilinders: productstickers, barcodestickers voor track & trace en productinformatie.',
    'Kwaliteit',
    'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&q=80&w=2000',
    10,
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
    'Waarom stickers ertoe doen',
    E'**"Een medicinale cilinder is een farmaceutisch product — de sticker is het gezicht ervan."**\n\nVergelijk het met medicijnen in de apotheek: je verwacht een correct, leesbaar etiket. Niemand accepteert een doosje pillen met een scheef, half leesbaar stickertje. Bij onze cilinders is dat niet anders.\n\nEen slordige of verkeerde sticker betekent:\n*   Een **onprofessioneel product** dat niet geleverd mag worden\n*   Mogelijke **afkeur bij kwaliteitscontrole** — en dus herwerk voor jou\n*   Problemen bij **track & trace** als de barcode niet scanbaar is\n*   In het ergste geval: **wettelijke overtredingen** en gevaar voor de patiënt\n\n**Jij bent de laatste schakel vóór de klant.** Wat jij aflevert, vertegenwoordigt het hele bedrijf. Een nette cilinder begint bij een nette sticker.',
    v_base_order + 1
  );

  -- Sectie 2: Afbeelding
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'image',
    'Goed vs. fout gelabelde cilinder',
    'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&q=80&w=2000',
    v_base_order + 2
  );

  -- Sectie 3: Typen stickers
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Welke stickers zitten er op een medicinale cilinder?',
    E'Een medicinale eigendomscilinder draagt meerdere stickers. Elk heeft een eigen functie:\n\n**1. Productsticker (hoofdetiket)**\nDit is het belangrijkste etiket op de cilinder.\n*   Bevat: productnaam, gassoort, concentratie, farmaceutisch registratienummer\n*   Wettelijk verplichte informatie conform Farmatec/IGJ-eisen\n*   Moet **altijd leesbaar en onbeschadigd** zijn\n*   Bij beschadiging of onleesbaarheid: cilinder mag **niet** worden uitgeleverd\n\n**2. Barcodesticker (track & trace)**\nDe digitale identiteit van de cilinder.\n*   Unieke identificatie per cilinder\n*   Koppelt de cilinder aan vulling, batchnummer en houdbaarheidsdatum\n*   Moet **100% scanbaar** zijn — anders kan de cilinder niet verwerkt worden in het systeem\n*   Een niet-scanbare barcode = stilstand in het proces\n\n**3. Batchsticker / vulsticker**\nDe traceerbaarheid van productie tot eindgebruiker.\n*   Batchnummer, vuldatum, houdbaarheidsdatum\n*   Essentieel bij een eventuele recall of klacht\n*   Moet overeenkomen met de gegevens in het systeem\n\n**4. Eigendomssticker**\nIdentificeert de eigenaar van de cilinder.\n*   Niet overstickeren of beschadigen\n*   Bij onduidelijkheid: melden bij leidinggevende',
    v_base_order + 3
  );

  -- Sectie 4: Wettelijk kader
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Waarom is dit zo streng geregeld?',
    E'Medicinale gassen zijn **geen gewone industriële producten**. Ze vallen onder de **Geneesmiddelenwet** en de **EU GMP-richtlijnen** (Good Manufacturing Practice).\n\n**Wie houdt toezicht?**\nDe **Inspectie Gezondheidszorg en Jeugd (IGJ)** controleert of medicinale gasproducenten aan alle eisen voldoen — inclusief de etikettering.\n\n**Wat kan er misgaan bij stickerfouten?**\n*   **Recalls** — terugroepacties van hele batches cilinders. Enorme kosten en reputatieschade\n*   **Boetes en sancties** van de inspectie, tot sluiting van de productielijn\n*   **Gevaar voor patiënten** als een verkeerde gassoort of concentratie op de sticker staat\n*   **Verlies van certificering** — dan mag het bedrijf geen medicinale gassen meer produceren\n\nElke cilinder moet **volledig traceerbaar** zijn van productie tot patiënt. De stickers maken die traceerbaarheid mogelijk.\n\n*"Dit is geen bureaucratie — het beschermt de patiënt én het bedrijf."*',
    v_base_order + 4
  );

  -- Sectie 5: Barcode & Track & Trace
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'De barcode: klein stickertje, grote impact',
    E'De barcodesticker lijkt klein en onbelangrijk. Maar het is de **digitale identiteit** van de cilinder.\n\n**Zonder scanbare barcode kan de cilinder niet:**\n*   Ingeboekt worden in het systeem\n*   Gekoppeld worden aan een batch\n*   Vrijgegeven worden voor levering\n*   Getraceerd worden bij een klacht of recall\n\n**Veelvoorkomende problemen met barcodes:**\n*   Barcode over een **las of knik** geplakt → scanner kan hem niet lezen\n*   Barcode **beschadigd** door handling, stoten of weersinvloeden\n*   **Verkeerde barcode** op verkeerde cilinder → hele batch in gevaar\n*   Barcode **deels over andere sticker** geplakt → gedeeltelijk onleesbaar\n*   Barcode op een **vuil of vet oppervlak** geplakt → laat los tijdens transport\n\n**De gouden regel voor barcodes:**\n*"Test de barcode ALTIJD met de scanner vóór vrijgave. Geen scan = geen levering."*',
    v_base_order + 5
  );

  -- Sectie 6: Hoe plak je een sticker correct?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Stickers plakken als een pro',
    E'Correct stickeren is een vak. Met deze stappen lever je altijd een net product af:\n\n**Stap 1: Ondergrond voorbereiden**\n*   Cilinder moet **schoon en droog** zijn\n*   Verwijder oude of beschadigde stickers **volledig** (geen overstickeren tenzij de procedure dit toestaat)\n*   Geen vet, vuil of condensvocht op de plakpositie\n\n**Stap 2: Positie en uitlijning**\n*   Sticker **recht** en op de **aangewezen positie** plakken\n*   Productsticker moet zichtbaar zijn wanneer de cilinder in het rek staat\n*   Barcode op een **vlak, ononderbroken deel** van de cilinder — niet over een las of knik\n\n**Stap 3: Aanbrengen zonder fouten**\n*   Geen luchtbubbels, kreukels of omgevouwen hoeken\n*   Sticker in **één keer goed** plaatsen — niet lostrekken en opnieuw proberen\n*   Bij twijfel: **nieuwe sticker** pakken. Niet "goed genoeg" accepteren\n\n**Stap 4: Controle na het plakken**\n*   Is de sticker recht en volledig aangedrukt?\n*   Is alle tekst leesbaar?\n*   Is de barcode scanbaar? → **Altijd testen met de scanner!**\n*   Komt de gassoort op de sticker overeen met de kleurcodering van de cilinderschouder?',
    v_base_order + 6
  );

  -- Sectie 7: Checklist dagelijkse controle
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Checklist: Stickers controleren vóór vrijgave',
    '[
      {"text": "Productsticker aanwezig, correct en leesbaar"},
      {"text": "Barcodesticker aanwezig en 100% scanbaar getest met scanner"},
      {"text": "Batchnummer en houdbaarheidsdatum correct en leesbaar"},
      {"text": "Sticker(s) recht geplakt, zonder bubbels, kreukels of beschadigingen"},
      {"text": "Geen oude stickers zichtbaar onder of naast de nieuwe sticker"},
      {"text": "Gassoort op sticker komt overeen met kleurcodering cilinderschouder"},
      {"text": "Cilinderoppervlak was schoon en droog vóór het plakken"},
      {"text": "Bij twijfel over leesbaarheid: nieuwe sticker aangebracht"}
    ]',
    v_base_order + 7
  );

  -- Sectie 8: Veelgemaakte fouten
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Top 5 fouten die we willen voorkomen',
    E'Deze fouten zien we helaas regelmatig. Herkenbaar? Dan weet je nu hoe je het voorkomt.\n\n**1. Overstickeren**\nNieuwe sticker over een oude plakken zonder de oude te verwijderen. Resultaat: dikke, bobbelige laag die loslaat en er slordig uitziet.\n→ **Oplossing:** Oude sticker altijd volledig verwijderen, oppervlak reinigen.\n\n**2. Scheef plakken**\n"Zit er toch op" — maar het ziet er onprofessioneel uit en kan de barcode onleesbaar maken als deze over een rand loopt.\n→ **Oplossing:** Neem de tijd. Eén keer goed is sneller dan twee keer opnieuw.\n\n**3. Barcode niet testen**\nErvan uitgaan dat de barcode wel werkt. Bij de volgende stap in het proces: stilstand, en de cilinder moet terug.\n→ **Oplossing:** Scan de barcode ALTIJD voordat de cilinder verder gaat.\n\n**4. Verkeerde sticker op verkeerde cilinder**\nKan leiden tot een recall van de hele batch en in het ergste geval gevaar voor de patiënt.\n→ **Oplossing:** Controleer altijd gassoort + cilindernummer vóór het plakken.\n\n**5. Plakken op een vuile of natte cilinder**\nSticker laat los tijdens transport of opslag. Bij aankomst bij de klant: een kaal, onherkenbaar product.\n→ **Oplossing:** Maak het oppervlak schoon en droog vóór het stickeren.',
    v_base_order + 8
  );

  -- Sectie 9: Procedure bij stickerfouten
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Procedure bij stickerfouten',
    E'Fouten gebeuren. Het gaat erom hoe je ermee omgaat.\n\n**Fout ontdekt VÓÓR vrijgave:**\n1.  Verwijder de foutieve sticker volledig\n2.  Reinig het oppervlak\n3.  Breng een correcte nieuwe sticker aan\n4.  Documenteer de correctie conform het kwaliteitssysteem\n\n**Fout ontdekt NÁ vrijgave:**\n1.  Meld **direct** bij de leidinggevende en/of kwaliteitsafdeling\n2.  Cilinder **blokkeren/terughalen** indien mogelijk\n3.  Batchbeoordeling: zijn er meer cilinders met dezelfde fout?\n4.  Afwijkingsrapport (deviation) opmaken\n\n**Bij twijfel: ALTIJD melden.**\nLiever een onterechte melding dan een gemiste fout die bij de patiënt terechtkomt.\n\n*"Een fout melden is geen zwakte — het is vakmanschap. Wegkijken is het echte probleem."*',
    v_base_order + 9
  );

  -- Sectie 10: Het belang voor jouw werk
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Goed stickeren = makkelijker werken',
    E'Correct etiketteren is niet alleen een verplichting — het maakt jouw werk ook makkelijker.\n\n*   **Nette stickers** → minder afgekeurde cilinders → **minder herwerk**\n*   **Scanbare barcodes** → snellere verwerking in het systeem → **minder wachttijd**\n*   **Correcte labels** → geen recalls → **geen extra administratie en stress**\n*   **Professioneel product** → trots op je werk → **tevreden klanten**\n\nElke cilinder die de deur uitgaat met een correcte, nette sticker is er eentje die **niet terugkomt** voor herwerk. Dat bespaart jou tijd en frustratie.\n\nEn onthoud: de klant — of dat nu een ziekenhuis, een ambulancedienst of een huisarts is — vertrouwt erop dat wat er op de sticker staat, klopt. Dat vertrouwen begint bij jou.\n\n*"Een net product begint bij jou aan de vullijn."*',
    v_base_order + 10
  );

  -- Sectie 11: Quiz
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'quiz',
    'Test je kennis: Stickers & Etikettering',
    '[
      {
        "question": "Waarom vallen medicinale gasstickers onder strenge regels?",
        "options": ["Omdat het er netjes uit moet zien", "Omdat medicinale gassen farmaceutische producten zijn onder de Geneesmiddelenwet", "Omdat de klant erom vraagt", "Omdat de stickers duur zijn"],
        "correct": 1
      },
      {
        "question": "Wat moet je altijd doen na het plakken van een barcodesticker?",
        "options": ["De sticker extra aandrukken met een doek", "De barcode testen met de scanner", "Een foto maken voor de administratie", "De cilinder 10 minuten laten drogen"],
        "correct": 1
      },
      {
        "question": "Wat is het grootste risico van een verkeerde productsticker?",
        "options": ["De cilinder ziet er niet mooi uit", "De patiënt kan het verkeerde gas toegediend krijgen", "De cilinder wordt te zwaar", "De barcode werkt niet meer"],
        "correct": 1
      },
      {
        "question": "Mag je een nieuwe sticker over een oude sticker plakken?",
        "options": ["Ja, dat bespaart tijd", "Ja, als de oude sticker nog goed zit", "Nee, tenzij de procedure dit expliciet toestaat", "Nee, want stickers zijn te duur om dubbel te gebruiken"],
        "correct": 2
      },
      {
        "question": "Wat doe je als je ontdekt dat een vrijgegeven cilinder een verkeerde sticker heeft?",
        "options": ["Niets, het is al verzonden", "Direct melden bij leidinggevende of kwaliteitsafdeling", "Zelf een nieuwe sticker plakken bij de volgende ronde", "De klant bellen"],
        "correct": 1
      },
      {
        "question": "Waarom moet de cilinder schoon en droog zijn vóór het stickeren?",
        "options": ["Anders kleurt de sticker af", "Zodat de sticker goed hecht en niet loslaat tijdens transport", "Omdat de inkt anders uitloopt", "Dat is niet nodig, stickers plakken altijd"],
        "correct": 1
      },
      {
        "question": "Wat is het voordeel van correcte barcodes voor jou als operator?",
        "options": ["Minder herwerk en snellere verwerking in het systeem", "Je krijgt een bonus", "De scanner maakt een leuk geluid", "Er is geen voordeel, het is alleen voor de administratie"],
        "correct": 0
      }
    ]',
    v_base_order + 11
  );

  -- Sectie 12: Afsluiting
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Samenvatting & afronding',
    E'**Onthoud deze kernpunten:**\n\n*   Een medicinale cilinder is een **farmaceutisch product** — de sticker is het visitekaartje\n*   Correcte, nette etikettering is **wettelijk verplicht** en beschermt de patiënt\n*   De barcode **altijd testen** met de scanner vóór vrijgave\n*   Bij twijfel: **nieuwe sticker** pakken. Bij fouten: **altijd melden**\n*   Goed stickeren bespaart jou herwerk en frustratie\n\n*"Jij maakt het verschil tussen een goed product en een afgekeurd product. Wees trots op wat je aflevert."*\n\nHeb je vragen of opmerkingen? Bespreek ze met je leidinggevende of de kwaliteitsafdeling.',
    v_base_order + 12
  );

END $$;
