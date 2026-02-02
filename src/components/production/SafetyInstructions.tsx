import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Snowflake, 
  Cylinder, 
  AlertTriangle, 
  Thermometer, 
  Wind, 
  Hand, 
  PackageOpen, 
  HeartPulse,
  Truck,
  Eye,
  Shield,
  Flame,
  Droplets,
  Footprints
} from "lucide-react";

// PPE Images
import cryogenicGloves from "@/assets/ppe/cryogenic-gloves.jpg";
import protectiveClothing from "@/assets/ppe/protective-clothing.jpg";
import safetyShoes from "@/assets/ppe/safety-shoes.jpg";

export function SafetyInstructions() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Dry Ice Safety Card */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Snowflake className="h-6 w-6 text-cyan-500" />
            </div>
            <div>
              <CardTitle className="text-xl">Droogijs Veiligheid</CardTitle>
              <CardDescription>Veilig werken met CO₂ in vaste vorm</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-semibold">Kritieke Waarschuwing</AlertTitle>
            <AlertDescription>
              Droogijs heeft een temperatuur van -78,5°C en sublimeert naar CO₂-gas. 
              Directe huidcontact veroorzaakt ernstige bevriezingsletsels.
            </AlertDescription>
          </Alert>

          <Accordion type="multiple" className="w-full" defaultValue={["behandeling"]}>
            <AccordionItem value="behandeling">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Hand className="h-4 w-4 text-cyan-500" />
                  <span>Behandelingsvoorschriften</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Draag altijd geïsoleerde cryogene handschoenen bij het hanteren van droogijs</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Gebruik een veiligheidsbril of gelaatsscherm ter bescherming van de ogen</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="mt-0.5 shrink-0">Aanbevolen</Badge>
                    <p>Gebruik tangen of schepjes voor het verplaatsen van kleinere stukken</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="mt-0.5 shrink-0">Aanbevolen</Badge>
                    <p>Draag lange mouwen en gesloten schoenen om blootgestelde huid te beperken</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="opslag">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <PackageOpen className="h-4 w-4 text-cyan-500" />
                  <span>Opslagrichtlijnen</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="destructive" className="mt-0.5 shrink-0">Gevaar</Badge>
                    <p>Bewaar droogijs NOOIT in een luchtdichte container - explosiegevaar door drukopbouw!</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Sla op in geïsoleerde, niet-luchtdichte containers (piepschuim dozen of speciale droogijscontainers)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Bewaar in goed geventileerde ruimtes - CO₂ verdringt zuurstof</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="mt-0.5 shrink-0">Let op</Badge>
                    <p>Droogijs sublimeert met 2-5 kg per 24 uur afhankelijk van omgevingstemperatuur</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="gevaren">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-cyan-500" />
                  <span>Gevaren & Risico's</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <div className="grid gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Thermometer className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Bevriezingsletsel</span>
                    </div>
                    <p className="text-muted-foreground">
                      Contact met huid of ogen veroorzaakt ernstige bevriezingsletsels vergelijkbaar met brandwonden. 
                      Slechts enkele seconden contact is genoeg voor letsel.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Wind className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Verstikkingsgevaar</span>
                    </div>
                    <p className="text-muted-foreground">
                      CO₂ is zwaarder dan lucht en verzamelt zich op de grond. In slecht geventileerde ruimtes 
                      kan dit leiden tot zuurstoftekort en bewusteloosheid.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Explosiegevaar</span>
                    </div>
                    <p className="text-muted-foreground">
                      In afgesloten containers bouwt druk op door sublimatie. Dit kan leiden tot 
                      een explosie met letsel tot gevolg.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ehbo">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-cyan-500" />
                  <span>EHBO Instructies</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="font-medium text-red-600 dark:text-red-400 mb-2">Bij huidcontact:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Verwijder het droogijs onmiddellijk van de huid</li>
                      <li>Spoel het getroffen gebied met lauwwarm water (niet heet!)</li>
                      <li>Wrijf niet over de huid - dit verergert het letsel</li>
                      <li>Bedek met een steriel verband en zoek medische hulp</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="font-medium text-red-600 dark:text-red-400 mb-2">Bij oogcontact:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Spoel onmiddellijk met lauwwarm water gedurende minimaal 15 minuten</li>
                      <li>Zoek direct medische hulp</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="font-medium text-red-600 dark:text-red-400 mb-2">Bij inademen (CO₂):</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Breng de persoon naar frisse lucht</li>
                      <li>Bij bewusteloosheid: stabiele zijligging en 112 bellen</li>
                      <li>Indien nodig reanimatie starten</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="pbm-droogijs">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-cyan-500" />
                  <span>Persoonlijke Beschermingsmiddelen</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-sm">
                {/* PPE Images Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-full aspect-square rounded-lg overflow-hidden border border-border/50 bg-white">
                      <img 
                        src={cryogenicGloves} 
                        alt="Cryogene handschoenen" 
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                    <span className="text-xs text-center text-muted-foreground">Cryogene handschoenen</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-full aspect-square rounded-lg overflow-hidden border border-border/50 bg-white">
                      <img 
                        src={protectiveClothing} 
                        alt="Beschermende kleding" 
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                    <span className="text-xs text-center text-muted-foreground">Beschermende kleding</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-full aspect-square rounded-lg overflow-hidden border border-border/50 bg-white">
                      <img 
                        src={safetyShoes} 
                        alt="Veiligheidsschoenen" 
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                    <span className="text-xs text-center text-muted-foreground">Veiligheidsschoenen</span>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Hand className="h-4 w-4 text-cyan-500" />
                      <span className="font-medium">Cryogene Handschoenen</span>
                    </div>
                    <p className="text-muted-foreground">
                      Gebruik altijd speciale cryogene of geïsoleerde handschoenen bij het hanteren van droogijs. 
                      Normale handschoenen bieden onvoldoende bescherming tegen -78,5°C.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Oogbescherming</span>
                    </div>
                    <p className="text-muted-foreground">
                      Draag een veiligheidsbril of gelaatsscherm ter bescherming tegen rondspattende 
                      stukjes droogijs bij het breken of verwerken.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Beschermende Kleding</span>
                    </div>
                    <p className="text-muted-foreground">
                      Draag lange mouwen, lange broek en gesloten schoenen. Vermijd kleding die 
                      droogijs kan vasthouden (zoals wijde zakken of open schoenen).
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Footprints className="h-4 w-4 text-amber-600" />
                      <span className="font-medium">Veiligheidsschoenen</span>
                    </div>
                    <p className="text-muted-foreground">
                      Draag gesloten veiligheidsschoenen met stalen neuzen. Open schoenen of sandalen 
                      zijn verboden bij het werken met droogijs.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Wind className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Ventilatie & Ademhaling</span>
                    </div>
                    <p className="text-muted-foreground">
                      Werk altijd in goed geventileerde ruimtes. Bij werken in afgesloten ruimtes of 
                      bij grote hoeveelheden droogijs kan een CO₂-meter of ademhalingsbescherming nodig zijn.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Gas Cylinder Safety Card */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Cylinder className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-xl">Gascilinder Veiligheid</CardTitle>
              <CardDescription>Veilig werken met hogedruk gascilinders</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-semibold">Kritieke Waarschuwing</AlertTitle>
            <AlertDescription>
              Gascilinders staan onder hoge druk (tot 300 bar). Een beschadigde cilinder of klep 
              kan leiden tot een explosie of het wegvliegen van de cilinder als een projectiel.
            </AlertDescription>
          </Alert>

          <Accordion type="multiple" className="w-full" defaultValue={["behandeling-transport"]}>
            <AccordionItem value="behandeling-transport">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-orange-500" />
                  <span>Behandeling & Transport</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Transporteer cilinders altijd rechtop en goed vastgezet</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Gebruik een geschikte cilinderwagen voor verplaatsing - rol of sleep cilinders nooit</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Zorg dat de beschermkap op de klep zit tijdens transport en opslag</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="destructive" className="mt-0.5 shrink-0">Verboden</Badge>
                    <p>Laat cilinders nooit vallen, stoten of rollen - dit kan de klep beschadigen</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="destructive" className="mt-0.5 shrink-0">Verboden</Badge>
                    <p>Til cilinders nooit aan de klep of beschermkap op</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="opslag">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <PackageOpen className="h-4 w-4 text-orange-500" />
                  <span>Opslagvoorschriften</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Bewaar cilinders rechtopstaand en vastgezet aan muur of rek</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Sla op in een droge, goed geventileerde ruimte</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Houd de opslagtemperatuur onder 52°C</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="warning" className="mt-0.5 shrink-0">Let op</Badge>
                    <p>Scheid volle en lege cilinders duidelijk van elkaar</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="warning" className="mt-0.5 shrink-0">Let op</Badge>
                    <p>Houd brandbare gassen gescheiden van oxiderende gassen (min. 3 meter of brandwerende muur)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="destructive" className="mt-0.5 shrink-0">Verboden</Badge>
                    <p>Bewaar cilinders niet in kelders of slecht geventileerde ruimtes</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="gebruik">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>Gebruiksrichtlijnen</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Gebruik altijd het juiste reduceerventiel voor het specifieke gastype</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Controleer op lekkages met sop water of een gasdetector - nooit met een vlam!</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="info" className="mt-0.5 shrink-0">Verplicht</Badge>
                    <p>Open de afsluiter langzaam en geleidelijk</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="warning" className="mt-0.5 shrink-0">Let op</Badge>
                    <p>Sluit de afsluiter na gebruik volledig af, ook bij lege cilinders</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="destructive" className="mt-0.5 shrink-0">Verboden</Badge>
                    <p>Gebruik nooit olie of vet op kleppen of reduceerventiel (explosiegevaar bij zuurstof!)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="destructive" className="mt-0.5 shrink-0">Verboden</Badge>
                    <p>Probeer nooit een vastgelopen klep met gereedschap los te maken</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="pbm">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-orange-500" />
                  <span>Persoonlijke Beschermingsmiddelen</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <div className="grid gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Oogbescherming</span>
                    </div>
                    <p className="text-muted-foreground">
                      Draag altijd een veiligheidsbril of gelaatsscherm bij het werken met gascilinders, 
                      vooral bij het aansluiten of loskoppelen van reduceerventiel.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Hand className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Handbescherming</span>
                    </div>
                    <p className="text-muted-foreground">
                      Gebruik werkhandschoenen om snijwonden en beknelling te voorkomen. 
                      Bij cryogene gassen: speciale koudebestendige handschoenen.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Droplets className="h-4 w-4 text-cyan-500" />
                      <span className="font-medium">Veiligheidsschoenen</span>
                    </div>
                    <p className="text-muted-foreground">
                      Draag veiligheidsschoenen met stalen neus (S3) ter bescherming tegen vallende cilinders.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
