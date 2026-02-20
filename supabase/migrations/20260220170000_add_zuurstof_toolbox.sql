-- Create a new toolbox: "Veiligheidstraining Zuurstof (O₂)"
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
    'Toolbox Meeting — Veiligheidstraining Zuurstof (O₂)',
    'Leer de eigenschappen en gevaren van zuurstof kennen en hoe je veilig werkt bij het vullen van O₂-cilinders.',
    'Veiligheid',
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=2000',
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
    'Waarom is dit belangrijk?',
    E'**"Bij het aansluiten van een zuurstofcilinder zat er een beetje vet op de koppeling. Binnen een fractie van een seconde was er een felle vlam. De operator had geluk — hij droeg zijn handschoenen."**\n\nZuurstof is het gas waar we het meest mee werken. Het lijkt veilig — we ademen het tenslotte de hele dag in. Maar juist die bekendheid maakt het gevaarlijk. Operators onderschatten zuurstof.\n\nZuurstof is **niet brandbaar**, maar het is de ultieme **brandversneller**. Alles brandt feller, sneller en heviger in een zuurstofrijke omgeving. Materialen die normaal niet branden, ontbranden wél in contact met zuurstof.\n\nIn deze toolbox leer je waarom zuurstof zo gevaarlijk is en hoe je er veilig mee werkt.',
    v_base_order + 1
  );

  -- Sectie 2: Afbeelding
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'image',
    'Zuurstof op de werkvloer',
    'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&q=80&w=2000',
    v_base_order + 2
  );

  -- Sectie 3: Wat is zuurstof?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Wat is zuurstof (O₂)?',
    E'Zuurstof is een **kleurloos, reukloos gas** dat ongeveer **21% van de lucht** uitmaakt. Zonder zuurstof is er geen leven mogelijk — het is essentieel voor ademhaling.\n\nIn de industrie wordt zuurstof gebruikt voor:\n*   **Lassen en snijden** (autogeen)\n*   **Medische toepassingen** (ziekenhuizen, ambulances)\n*   **Waterbehandeling** en zuivering\n*   **Voedselindustrie** (verpakken onder beschermende atmosfeer)\n\n**Belangrijke eigenschappen:**\n*   Zuurstof is **iets zwaarder dan lucht** (factor 1,1)\n*   Onder druk wordt zuurstof opgeslagen tot **200 of 300 bar** in cilinders\n*   Zuurstof is **niet brandbaar** — maar het is een extreem krachtige **brandversneller**\n*   In een zuurstofrijke omgeving branden materialen **veel sneller en feller**\n\n*"Zuurstof zelf brandt niet. Maar alles om je heen brandt wél — en veel heviger dan je verwacht."*',
    v_base_order + 3
  );

  -- Sectie 4: Waarom is zuurstof gevaarlijk?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    '⚠️ De gevaren van zuurstof',
    E'**1. Brandversnelling — het grootste gevaar**\nNormale lucht bevat 21% zuurstof. Bij een **verhoging naar 24%** verandert het brandgevaar al drastisch:\n*   Kleding kan **spontaan vlam vatten** bij een vonk\n*   Vet en olie ontbranden **explosief** bij contact met zuurstof onder druk\n*   Rubber, kunststof en textiel branden **oncontroleerbaar**\n*   Branden zijn **zeer moeilijk te blussen** in een zuurstofrijke omgeving\n\n**2. Adiabatische compressie — brand zonder vlam**\nAls je een zuurstofventiel **te snel opent**, wordt het gas razendsnel samengeperst. Dit genereert extreme hitte. Een klein beetje vuil, vet of een rubber O-ring kan hierdoor **spontaan ontbranden** — zonder vonk, zonder vlam, zonder waarschuwing.\n\n*"Dit is de oorzaak van veel fakkelbranden bij zuurstofcilinders."*\n\n**3. Zuurstofverrijking van kleding**\nAls zuurstof lekt in een slecht geventileerde ruimte, kan je **kleding zuurstof absorberen**. Je merkt het niet. Maar als je daarna in contact komt met een vonk of vlam, staat je kleding binnen seconden in lichterlaaie.\n\n*   Dit effect houdt **tot 30 minuten** aan nadat je de zuurstofrijke omgeving hebt verlaten\n*   Synthetische kleding (polyester, nylon) is extra gevaarlijk — het smelt op de huid\n\n**4. Hoge druk**\nZuurstofcilinders staan onder **200-300 bar** druk. Een beschadigd ventiel of gebroken leiding kan:\n*   Onderdelen als projectiel wegschieten\n*   Een fakkelbrand veroorzaken\n*   Ernstig lichamelijk letsel veroorzaken',
    v_base_order + 4
  );

  -- Sectie 5: De gouden regel — VETVRIJ
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    '🛑 De gouden regel: VETVRIJ',
    E'**Bij zuurstof geldt één absolute regel: ALLES moet VETVRIJ zijn.**\n\nDit is de belangrijkste veiligheidsregel bij het werken met zuurstof. Vet en olie in combinatie met zuurstof onder druk is een **explosieve combinatie**.\n\n**Wat betekent vetvrij werken?**\n*   Je handen zijn **schoon en vetvrij** voordat je een zuurstofcilinder aanraakt\n*   Het ventiel, de koppeling en de vulslang zijn **vrij van vet, olie en vuil**\n*   Gebruik **NOOIT** regulier smeermiddel of vet bij zuurstofaansluitingen\n*   Gebruik alleen **goedgekeurde zuurstof-compatibele smeermiddelen** (bijv. Krytox of PTFE-gebaseerd)\n*   **Poetsdoeken met olie of vet** mogen NOOIT in de buurt van zuurstofcilinders liggen\n*   Gereedschap dat in contact komt met olie of vet mag **NIET** gebruikt worden bij zuurstof\n\n**Handcrème, lippenbalsem, zonnebrandcrème** — het klinkt onschuldig, maar het is allemaal vet. Raak na het smeren **NOOIT** een zuurstofventiel aan zonder je handen te wassen.\n\n*"Eén vingerafdruk met vet op een zuurstofventiel kan een fakkelbrand veroorzaken."*',
    v_base_order + 5
  );

  -- Sectie 6: Risicosituaties bij het vullen
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Risicosituaties bij het vullen van zuurstof',
    '[
      {"text": "Vet, olie of vuil op het ventiel, de koppeling of de vulslang"},
      {"text": "Te snel openen van het cilinderventiel (adiabatische compressie → ontbranding)"},
      {"text": "Beschadigde of ontbrekende O-ring/pakking (lekkage van zuurstof)"},
      {"text": "Verkeerd type O-ring (niet zuurstof-compatibel)"},
      {"text": "Lekkende aansluiting (zuurstofverrijking van de omgeving)"},
      {"text": "Olie- of vetdoeken in de buurt van de vulstand"},
      {"text": "Slechte ventilatie (zuurstofconcentratie boven 21%)"},
      {"text": "Vonkgevende werkzaamheden (slijpen, lassen) in de buurt van zuurstof"},
      {"text": "Beschadigd ventiel of cilinder met deuken/corrosie"},
      {"text": "Verkeerde gassoort op de verkeerde vulramp"}
    ]',
    v_base_order + 6
  );

  -- Sectie 7: Hoe herken je het gevaar?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Signalen en waarschuwingen',
    E'Zuurstof zelf kun je **niet ruiken of zien**. Maar let op deze signalen:\n\n*   🔥 **Verkleuring of verbranding** aan het ventiel, de slang of de koppeling — teken van eerdere oververhitting\n*   💨 **Sissend geluid** bij het ventiel of de aansluiting — zuurstoflekkage\n*   🧴 **Vettige of olieachtige residuen** op het ventiel of je handen — STOP direct\n*   🌡️ **Warmte** aan de aansluiting die er niet hoort te zijn\n*   👃 **Brandgeur** of smeltend rubber — mogelijk begin van een fakkelbrand\n*   ⚡ **Vonken** in de buurt van zuurstofcilinders — direct melden\n\n**Let op: een zuurstofrijke omgeving merk je NIET.** Je voelt je niet anders bij 24% zuurstof. Maar je kleding is wel een brandbom geworden.\n\n**Bij elke onregelmatigheid: STOP, stap achteruit, en meld het.**',
    v_base_order + 7
  );

  -- Sectie 8: Noodprocedure
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    '🚨 NOODPROCEDURE: Brand bij zuurstof',
    E'**Bij een fakkelbrand of brand bij een zuurstofcilinder:**\n\n1.  **SLUIT HET VENTIEL** als dit veilig kan — draag hittebestendige handschoenen als beschikbaar\n2.  **GA WEG** als de vlam niet stopt of het ventiel niet bereikbaar is\n3.  **WAARSCHUW** collega''s direct (roep "BRAND") en druk op de noodknop\n4.  **BEL** de bedrijfshulpverlening of 112\n5.  **BLUS NIET MET WATER** op een lekkende zuurstofcilinder onder druk — gebruik een **poederblusser** of **CO₂-blusser** om de omgeving te koelen\n6.  **Koel omliggende cilinders** met water om drukopbouw te voorkomen (alleen als de brand onder controle is)\n\n**Bij zuurstofverrijking van kleding:**\n1.  Verlaat **direct** de zuurstofrijke omgeving\n2.  Ga **minimaal 30 minuten** NIET in de buurt van open vuur, vonken of hete oppervlakken\n3.  Laat je kleding **ventileren** in de buitenlucht\n\n**Regel nummer 1: NOOIT proberen een brandende cilinder te verplaatsen.**',
    v_base_order + 8
  );

  -- Sectie 9: Veiligheidschecklist
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Totaalchecklist: Veilig werken met zuurstof',
    '[
      {"text": "Mijn handen zijn SCHOON en VETVRIJ voordat ik een zuurstofcilinder aanraak"},
      {"text": "Het ventiel en de koppeling zijn vrij van vet, olie en vuil"},
      {"text": "De O-ring/pakking is aanwezig, onbeschadigd en zuurstof-compatibel"},
      {"text": "Ik open het cilinderventiel LANGZAAM en gecontroleerd"},
      {"text": "Er liggen GEEN olie- of vetdoeken in de buurt van de vulstand"},
      {"text": "De werkruimte is goed geventileerd"},
      {"text": "Er worden GEEN vonkgevende werkzaamheden uitgevoerd in de buurt"},
      {"text": "Ik gebruik NOOIT regulier smeermiddel bij zuurstofaansluitingen"},
      {"text": "Ik controleer de cilinder visueel op deuken, corrosie en ventielschade"},
      {"text": "Ik weet waar de brandblusser, noodknop en nooduitgang zijn"},
      {"text": "Ik meld lekkages, vetsporen of beschadigingen DIRECT"}
    ]',
    v_base_order + 9
  );

  -- Sectie 10: Quiz
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'quiz',
    'Test je kennis',
    '[
      {
        "question": "Is zuurstof brandbaar?",
        "options": ["Ja, zuurstof brandt heel makkelijk", "Nee, maar het is een extreem krachtige brandversneller", "Nee, en het is ook niet gevaarlijk", "Alleen bij hoge temperaturen"],
        "correct": 1
      },
      {
        "question": "Wat is de belangrijkste veiligheidsregel bij zuurstof?",
        "options": ["Altijd een masker dragen", "Alles moet VETVRIJ zijn", "Nooit alleen werken", "Altijd handschoenen dragen"],
        "correct": 1
      },
      {
        "question": "Wat gebeurt er als je een zuurstofventiel te snel opent?",
        "options": ["Er ontsnapt meer gas dan nodig", "Het ventiel gaat kapot", "De hitte door compressie kan vuil of vet laten ontbranden", "Er gebeurt niets bijzonders"],
        "correct": 2
      },
      {
        "question": "Waarom is handcrème gevaarlijk bij het werken met zuurstof?",
        "options": ["Het maakt de cilinder glad", "Handcrème is vet — vet + zuurstof onder druk = ontbrandingsgevaar", "Het beschadigt het ventiel", "Dat is het niet"],
        "correct": 1
      },
      {
        "question": "Hoe lang kan je kleding zuurstof vasthouden na een lekkage?",
        "options": ["1 minuut", "5 minuten", "Tot 30 minuten", "Kleding houdt geen zuurstof vast"],
        "correct": 2
      },
      {
        "question": "Wat doe je als EERSTE bij een fakkelbrand aan een zuurstofcilinder?",
        "options": ["Water erop gooien", "De cilinder verplaatsen", "Het ventiel dichtdraaien als dat veilig kan", "Doorwerken en wachten tot het stopt"],
        "correct": 2
      },
      {
        "question": "Bij welk zuurstofpercentage in de lucht wordt brandgevaar al serieus verhoogd?",
        "options": ["30%", "50%", "24%", "Pas boven 90%"],
        "correct": 2
      }
    ]',
    v_base_order + 10
  );

  -- Sectie 11: Afsluiting
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Tot slot',
    E'**Zuurstof is het meest gebruikte gas op de vulplaats. Juist daarom is het zo belangrijk dat je de gevaren kent.**\n\nOnthoud de gouden regel: **VETVRIJ.** Altijd. Zonder uitzondering.\n\nEn onthoud: een zuurstofrijke omgeving merk je niet. Je voelt je prima. Maar je kleding, je haar en alles om je heen is wél veel brandbaarder geworden.\n\n*"Respect voor zuurstof is respect voor jezelf en je collega''s. Dat is vakmanschap."*\n\nHeb je vragen? Vraag het je leidinggevende of de veiligheidscoördinator.',
    v_base_order + 11
  );

END $$;
