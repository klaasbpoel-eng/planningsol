-- Create a new toolbox: "Veiligheidstraining Kooldioxide (CO₂)"
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
    'Toolbox Meeting — Veiligheidstraining Kooldioxide (CO₂)',
    'Leer de eigenschappen en gevaren van kooldioxide en droogijs kennen en hoe je er veilig mee werkt op de vulplaats.',
    'Veiligheid',
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=2000',
    12,
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
    'Waarom is dit belangrijk?',
    E'**"Een collega voelde zich duizelig en misselijk na het vullen van CO₂-cilinders in een slecht geventileerde ruimte. Hij bleek zonder het te merken te weinig zuurstof te hebben ingeademd."**\n\nCO₂ is anders dan de meeste gassen waar je mee werkt. Het is niet alleen **verstikkend** (zoals stikstof of argon), maar ook **giftig** in hogere concentraties. En het is **kleurloos en reukloos** — je merkt het pas als het te laat is.\n\nDe drie hoofdrisico''s van CO₂:\n*   **Verstikking** — het verdringt zuurstof in de lucht\n*   **Vergiftiging** — CO₂ is in hoge concentraties giftig voor je zenuwstelsel\n*   **Bevriezing** — vloeibaar CO₂ en droogijs zijn extreem koud (-78,5°C)\n\nIn deze toolbox leer je alles wat je moet weten om veilig met CO₂ en droogijs te werken.',
    v_base_order + 1
  );

  -- Sectie 2: Afbeelding
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'image',
    'CO₂ op de werkvloer',
    'https://images.unsplash.com/photo-1611348586804-61bf6c080437?auto=format&fit=crop&q=80&w=2000',
    v_base_order + 2
  );

  -- Sectie 3: Wat is kooldioxide?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Wat is kooldioxide (CO₂)?',
    E'CO₂ is een **kleurloos, reukloos gas** dat van nature in de lucht zit (ongeveer 0,04%). Het ontstaat bij verbranding en ademhaling — je ademt het zelf uit.\n\nIn de industrie gebruiken we CO₂ voor: **lassen**, **koeling** (droogijs), de **drankenindustrie** (koolzuur), **brandblussers** en als **beschermgas**.\n\n*"Je kent het van de bubbels in frisdrank. Maar in hoge concentraties is datzelfde gas levensgevaarlijk."*\n\n**Belangrijke eigenschappen:**\n*   CO₂ is **1,5x zwaarder dan lucht** → het zakt naar beneden en hoopt zich op in putten, kelders en lage ruimtes\n*   Onder druk is CO₂ **vloeibaar** in de cilinder (bij kamertemperatuur boven ~57 bar)\n*   Bij snelle ontsnapping bevriest CO₂ direct tot **droogijs** (-78,5°C)\n\n**De drie vormen van CO₂:**\n1.  **Gas** — wat je inademt (onzichtbaar)\n2.  **Vloeistof** — onder druk in de cilinder\n3.  **Vast** — droogijs (bevroren CO₂, -78,5°C)',
    v_base_order + 3
  );

  -- Sectie 4: Waarom is CO₂ gevaarlijk?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    '⚠️ De drie gevaren van CO₂',
    E'**1. Verstikking (zuurstofverdringing)**\nCO₂ verdringt zuurstof in de lucht, net als inerte gassen. Maar CO₂ is **actiever**: je lichaam reageert op CO₂ met snellere ademhaling. Daardoor adem je nóg meer CO₂ in.\n*   20,9% zuurstof → normaal\n*   < 18% → gevaarlijk\n*   < 10% → bewusteloos binnen seconden\n\n**2. Vergiftiging (CO₂-intoxicatie)**\nAnders dan stikstof of argon is CO₂ ook **giftig** voor je zenuwstelsel.\n*   3-5% CO₂ in de lucht: hoofdpijn, duizeligheid, snellere ademhaling\n*   8-10%: bewusteloosheid binnen minuten\n*   > 10%: **dodelijk**, zelfs als er nog genoeg zuurstof is!\n\n*"Je kunt dus vergiftigd raken door CO₂, zelfs als er voldoende zuurstof in de ruimte is."*\n\n**3. Bevriezing (kouletsel)**\nVloeibaar CO₂ staat onder hoge druk in de cilinder. Bij lekkage of ontsnapping bevriest het direct tot **-78,5°C**. Contact met huid veroorzaakt **ernstige vrieswonden** (vergelijkbaar met brandwonden). Dit geldt ook voor droogijs.',
    v_base_order + 4
  );

  -- Sectie 5: Droogijs
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    '🧊 Droogijs — Wat je moet weten',
    E'**Wat is droogijs?**\nDroogijs is **bevroren CO₂** met een temperatuur van **-78,5°C**. Het heet "droog" ijs omdat het **niet smelt** maar direct verdampt (sublimeert) — er blijft geen water achter.\n\n⚠️ **1 kg droogijs wordt bij verdamping ~540 liter CO₂-gas.** Dat is enorm veel gas in een kleine ruimte!\n\n**Waar gebruiken wij droogijs voor?**\n*   **Koeling** van voedingsmiddelen, medicijnen en monsters tijdens transport\n*   **Reiniging** (droogijsstralen)\n*   **Verpakking en verzending** van temperatuurgevoelige producten\n*   Wij produceren droogijs als **pellets** (korrels), **blokken** of **plakken**\n\n**Gevaren van droogijs:**\n*   🌡️ **Ernstige vrieswonden** — pak droogijs NOOIT met blote handen vast. Draag altijd **koudebestendige handschoenen** en gebruik een **schep of tang**\n*   💨 **Verstikking** — droogijs verdampt continu en produceert CO₂-gas. In een afgesloten ruimte (koelcel, bestelbus, magazijn) kan de zuurstof snel verdrongen worden\n*   💥 **Drukopbouw** — bewaar droogijs NOOIT in een luchtdicht afgesloten vat of container. Het gas moet kunnen ontsnappen, anders bouwt de druk op en kan het vat **exploderen**\n*   👁️ **Oogletsel** — droogijssplinters kunnen ernstig oogletsel veroorzaken. Draag een **veiligheidsbril**\n\n**Vuistregels droogijs:**\n*   Bewaar in een **geïsoleerde maar NIET luchtdichte** container (piepschuim doos of speciale droogijsbox met ventilatieopening)\n*   Werk altijd in een **goed geventileerde ruimte**\n*   Vervoer droogijs NIET in een afgesloten personenauto — alleen in een auto met **gescheiden laadruimte** en ventilatie\n*   Gooi droogijs NOOIT in een gootsteen, toilet of afvoer — het kan leidingen laten scheuren door de extreme koude',
    v_base_order + 5
  );

  -- Sectie 6: Checklist droogijs
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Checklist: Veilig omgaan met droogijs',
    '[
      {"text": "Ik pak droogijs NOOIT met blote handen vast"},
      {"text": "Ik draag koudebestendige handschoenen en een veiligheidsbril"},
      {"text": "Ik bewaar droogijs in een geïsoleerde container met ventilatieopening (nooit luchtdicht!)"},
      {"text": "De opslagruimte is goed geventileerd"},
      {"text": "Ik vervoer droogijs NOOIT in een afgesloten personenauto"},
      {"text": "Ik gooi droogijs NOOIT in een gootsteen, toilet of afvoer"},
      {"text": "Ik weet dat 1 kg droogijs ~540 liter CO₂-gas wordt bij verdamping"},
      {"text": "Bij klachten (hoofdpijn, duizeligheid) verlaat ik DIRECT de ruimte"}
    ]',
    v_base_order + 6
  );

  -- Sectie 7: Risicosituaties bij het vullen
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Risicosituaties bij het vullen van CO₂',
    '[
      {"text": "Lekkage aan het ventiel of de aansluiting (CO₂ ontsnapt en hoopt zich op bij de grond)"},
      {"text": "Slechte ventilatie in de vulruimte (CO₂-concentratie bouwt op)"},
      {"text": "Overvulling van de cilinder (te veel vloeistof → bij opwarming extreme drukopbouw)"},
      {"text": "Droogijsvorming bij het ventiel door snel ontsnappend gas"},
      {"text": "Contact met vloeibaar CO₂ bij het loskoppelen onder restdruk"},
      {"text": "Beschadigd ventiel dat niet goed afsluit"},
      {"text": "Werken in een put of verdieping onder de vulramp (CO₂ zakt naar beneden!)"},
      {"text": "Geen CO₂-melder aanwezig of CO₂-melder niet gekalibreerd"},
      {"text": "Droogijsproductie in een afgesloten ruimte zonder afzuiging"}
    ]',
    v_base_order + 7
  );

  -- Sectie 8: Signalen en waarschuwingen
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Signalen en waarschuwingen',
    E'**CO₂ kun je niet ruiken of zien.** Let daarom op deze indirecte signalen:\n\n*   🔔 **CO₂-melder slaat alarm** — neem dit ALTIJD serieus\n*   🥴 **Klachten bij jezelf of collega''s**: hoofdpijn, duizeligheid, misselijkheid, snellere ademhaling, oorsuizen\n*   💨 **Sissend geluid** bij een cilinder of leiding (lekkage)\n*   🧊 **Witte nevel of ijsvorming** bij een ventiel of aansluiting (ontsnappend vloeibaar CO₂)\n*   🧊 **Onverwacht veel damp** rond de droogijsmachine of opslagcontainer\n*   🕳️ **Werken in een lage ruimte** zonder meting = altijd verdacht\n\n**Bij de eerste klachten: STOP direct en ga naar buiten. CO₂-vergiftiging verergert snel.**\n\n**Vertrouw de CO₂-melder, niet je gevoel. Je lichaam waarschuwt te laat.**',
    v_base_order + 8
  );

  -- Sectie 9: Noodprocedure
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    '🚨 NOODPROCEDURE: CO₂-incident',
    E'1.  **GA NIET de ruimte in** als je vermoedt dat er te veel CO₂ is — jij wordt anders het volgende slachtoffer\n2.  **WAARSCHUW** collega''s direct en druk op de noodknop\n3.  **VENTILEER** de ruimte van buitenaf (deuren open, ventilatie op maximaal)\n4.  **BEL** de bedrijfshulpverlening of 112\n5.  **Wacht op hulp** met adembescherming (persluchtmasker) voordat iemand de ruimte betreedt\n6.  **Slachtoffer bereikt?** Breng naar frisse lucht, houd warm, start eerste hulp\n\n**Bij kouletsel door vloeibaar CO₂ of droogijs:**\n1.  Spoel het getroffen gebied met **lauwwarm water** (niet heet!)\n2.  Verwijder kleding die vastzit **NIET** — laat dit over aan medisch personeel\n3.  Dek de wond af en zoek medische hulp\n\n**Regel nummer 1: Word NOOIT zelf het tweede slachtoffer.**',
    v_base_order + 9
  );

  -- Sectie 10: Totaalchecklist
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Totaalchecklist: Veilig werken met CO₂',
    '[
      {"text": "De CO₂-melder in de vulruimte is aan en gekalibreerd"},
      {"text": "De werkruimte is goed geventileerd (mechanische afzuiging actief)"},
      {"text": "Ik draag koudebestendige handschoenen bij het aansluiten en loskoppelen"},
      {"text": "Ik draag een veiligheidsbril bij het werken met CO₂ onder druk"},
      {"text": "Ik controleer het ventiel en de aansluiting op lekkage vóór het vullen"},
      {"text": "Ik vul niet meer dan het voorgeschreven vulgewicht (weegschaal gecontroleerd)"},
      {"text": "Ik werk nooit alleen in een afgesloten ruimte met CO₂"},
      {"text": "Ik weet waar de noodknop, nooduitgang en het persluchtmasker zijn"},
      {"text": "Ik hanteer droogijs alleen met handschoenen, bril en schep/tang"},
      {"text": "Ik meld lekkages of defecte ventielen DIRECT"}
    ]',
    v_base_order + 10
  );

  -- Sectie 11: Quiz
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'quiz',
    'Test je kennis',
    '[
      {
        "question": "Wat maakt CO₂ anders dan inerte gassen zoals stikstof?",
        "options": ["CO₂ ruikt naar rotte eieren", "CO₂ is lichter dan lucht", "CO₂ is ook giftig, niet alleen verstikkend", "Er is geen verschil"],
        "correct": 2
      },
      {
        "question": "Waarom is CO₂ extra gevaarlijk in een kelder of put?",
        "options": ["Omdat het daar warmer is", "Omdat CO₂ zwaarder is dan lucht en naar beneden zakt", "Omdat er meer zuurstof is", "Dat is het niet"],
        "correct": 1
      },
      {
        "question": "Wat is de temperatuur van droogijs?",
        "options": ["0°C", "-20°C", "-78,5°C", "-200°C"],
        "correct": 2
      },
      {
        "question": "Hoeveel CO₂-gas levert 1 kg droogijs op bij verdamping?",
        "options": ["Ongeveer 10 liter", "Ongeveer 100 liter", "Ongeveer 540 liter", "Ongeveer 5000 liter"],
        "correct": 2
      },
      {
        "question": "Waarom mag je droogijs NOOIT in een luchtdicht vat bewaren?",
        "options": ["Omdat het dan sneller smelt", "Omdat het gas niet kan ontsnappen en het vat kan exploderen", "Omdat het dan gaat stinken", "Dat mag eigenlijk wel"],
        "correct": 1
      },
      {
        "question": "Wat doe je als je duizelig wordt tijdens het vullen van CO₂?",
        "options": ["Even pauze nemen en doorwerken", "Raam openzetten en doorgaan", "Direct stoppen, de ruimte verlaten en melden", "Wachten tot het overgaat"],
        "correct": 2
      },
      {
        "question": "Hoe behandel je een vrieswond door droogijs?",
        "options": ["Wrijven met sneeuw", "Hete kruik erop leggen", "Spoelen met lauwwarm water en medische hulp zoeken", "Niets doen, het gaat vanzelf over"],
        "correct": 2
      }
    ]',
    v_base_order + 11
  );

  -- Sectie 12: Afsluiting
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Tot slot',
    E'**CO₂ is een veelzijdig gas, maar onderschat het niet. Het is kleurloos, reukloos én giftig. En droogijs is -78,5°C — behandel het met respect.**\n\nBij de eerste klachten (hoofdpijn, duizeligheid) **direct stoppen en de ruimte verlaten**. Dat is geen overdreven reactie, dat is de juiste reactie.\n\n*"Door alert te zijn en de regels te volgen, bescherm je jezelf en je collega''s. Dat is vakmanschap."*\n\nHeb je vragen? Vraag het je leidinggevende of de veiligheidscoördinator.',
    v_base_order + 12
  );

END $$;
