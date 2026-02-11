
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DeploymentManual() {
    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Handleiding: Deployment via DirectAdmin</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <h1>Handleiding: Project Deployen op Apache (DirectAdmin)</h1>
                        <p>
                            Dit project is een <strong>Single Page Application (SPA)</strong> gebouwd met React en Vite. Het maakt gebruik van <strong>Supabase</strong> als backend (database en authenticatie). Omdat het een SPA is, heb je geen Node.js of PHP server nodig om het te draaien, alleen een webserver die statische bestanden kan serveren (zoals Apache, Nginx, etc.).
                        </p>
                        <p>Hieronder staan de stappen om dit project te hosten op een Apache server via DirectAdmin.</p>

                        <h2>Deel 1: Handmatige Deployment</h2>

                        <h3>1. Voorbereiding</h3>
                        <p>Zorg ervoor dat je de volgende zaken gereed hebt:</p>
                        <ul>
                            <li><strong>Lokale omgeving</strong>: Node.js geïnstalleerd op je computer.</li>
                            <li><strong>DirectAdmin toegang</strong>: Login gegevens voor je hostingpaneel.</li>
                            <li><strong>Supabase project</strong>: Een actief Supabase project met de juiste URL en API keys.</li>
                        </ul>

                        <h3>2. Environment Variabelen (.env)</h3>
                        <p>Controleer of je een <code>.env</code> bestand hebt in de root van je project met de juiste productie-instellingen voor Supabase. Vite gebruikt deze variabelen tijdens het bouwproces.</p>
                        <pre><code>
                            VITE_SUPABASE_URL=jouw_supabase_project_url
                            VITE_SUPABASE_ANON_KEY=jouw_supabase_anon_key
                        </code></pre>
                        <blockquote>
                            <p><strong>Let op:</strong> Herstart je ontwikkelserver of bouwproces altijd nadat je <code>.env</code> aanpast.</p>
                        </blockquote>

                        <h3>3. Het Project Bouwen</h3>
                        <p>Omdat browsers geen ruwe React/TypeScript code kunnen lezen, moet je het project eerst "bouwen" naar statische HTML, CSS en JavaScript bestanden.</p>
                        <p>Open een terminal in je projectmap en voer uit:</p>
                        <pre><code>npm run build</code></pre>
                        <p>Dit proces maakt een nieuwe map aan genaamd <strong><code>dist</code></strong>. De inhoud van deze map is wat je naar de server gaat uploaden.</p>

                        <h3>4. Uploaden naar de Server</h3>
                        <ol>
                            <li>Log in op <strong>DirectAdmin</strong>.</li>
                            <li>Ga naar <strong>File Manager</strong> (Bestandsbeheer).</li>
                            <li>Navigeer naar de map <code>public_html</code> (of de submap waar je de site wilt hebben, bijv. <code>public_html/mijnapp</code>).</li>
                            <li>Verwijder eventuele standaardbestanden (zoals <code>index.php</code> of <code>default.html</code>) als deze in de weg staan.</li>
                            <li>Upload <strong>alle inhoud</strong> van de lokale <code>dist</code> map naar deze map op de server. (Je zou nu een <code>index.html</code>, een <code>assets</code> map, en mogelijk andere bestanden in je <code>public_html</code> moeten zien).</li>
                        </ol>

                        <h3>5. Apache Configuratie (.htaccess)</h3>
                        <p>
                            Omdat dit een Single Page App is met Client-Side Routing (via React Router), moet je de server vertellen dat alle verzoeken (die geen bestand zijn) naar <code>index.html</code> moeten worden gestuurd. Anders krijg je een 404-fout als je bijvoorbeeld direct naar <code>jouwdomein.com/login</code> gaat of de pagina ververst.
                        </p>
                        <p>Maak in DirectAdmin (in dezelfde map als je <code>index.html</code>) een nieuw bestand aan genaamd <strong><code>.htaccess</code></strong> met de volgende inhoud:</p>

                        <pre><code>
                            &lt;IfModule mod_rewrite.c&gt;
                            RewriteEngine On
                            RewriteBase /
                            RewriteRule ^index\.html$ - [L]
                            RewriteCond %&#123;REQUEST_FILENAME&#125; !-f
                            RewriteCond %&#123;REQUEST_FILENAME&#125; !-d
                            RewriteCond %&#123;REQUEST_FILENAME&#125; !-l
                            RewriteRule . /index.html [L]
                            &lt;/IfModule&gt;
                        </code></pre>

                        <blockquote>
                            <p><strong>Let op:</strong> Als je de app in een submap plaatst (bijvoorbeeld <code>jouwdomein.com/app/</code>), moet je de <code>RewriteBase /</code> aanpassen naar <code>RewriteBase /app/</code> en ook in je <code>vite.config.ts</code> de <code>base</code> property instellen op <code>'/app/'</code> voordat je bouwt.</p>
                        </blockquote>

                        <div className="bg-yellow-50 border border-yellow-200 p-4 my-4 rounded-md text-yellow-800">
                            <strong>Mijn API calls werken niet?</strong> Controleer of je tijdens het bouwen (<code>npm run build</code>) de juiste <code>.env</code> variabelen had ingesteld. De API keys worden "ingebakken" in de JavaScript bestanden tijdens de build.
                        </div>

                        <hr className="my-8" />

                        <h2>Deel 2: Automatische Deployment Instellen (Optioneel)</h2>
                        <p>Je kunt de knop "Start Deployment" in het tabblad "Algemeen" gebruiken. Hiermee kan de beheerder met één klik de site opnieuw laten bouwen en uploaden.</p>

                        <h3>1. GitHub Secrets Instellen</h3>
                        <p>Ga naar je GitHub Repository -&gt; <strong>Settings</strong> -&gt; <strong>Secrets and variables</strong> -&gt; <strong>Actions</strong> -&gt; <strong>New repository secret</strong>.</p>
                        <p>Voeg de volgende secrets toe:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><code>FTP_SERVER</code>: Je FTP server adres (bijv. <code>ftp.jouwdomein.com</code>)</li>
                            <li><code>FTP_USERNAME</code>: Je FTP gebruikersnaam</li>
                            <li><code>FTP_PASSWORD</code>: Je FTP wachtwoord</li>
                            <li><code>VITE_SUPABASE_URL</code>: Je Supabase URL (zie <code>.env</code>)</li>
                            <li><code>VITE_SUPABASE_ANON_KEY</code>: Je Supabase Anon Key (zie <code>.env</code>)</li>
                        </ul>

                        <h3>2. Supabase Edge Function Deployen</h3>
                        <p>Je moet de backend functie <code>trigger-github-workflow</code> deployen naar Supabase.</p>
                        <pre><code>npx supabase functions deploy trigger-github-workflow --no-verify-jwt</code></pre>

                        <h3>3. Supabase Secrets Instellen</h3>
                        <p>De Edge Function heeft een toegangscode nodig om GitHub aan te sturen.</p>
                        <ol>
                            <li>
                                Maak een <strong>GitHub Personal Access Token (Classic)</strong> aan:
                                <ul className="list-disc pl-5 mt-1">
                                    <li>Ga naar GitHub -&gt; Settings -&gt; Developer settings -&gt; Personal access tokens -&gt; Tokens (classic).</li>
                                    <li>Generate new token (classic).</li>
                                    <li>Vink <strong><code>repo</code></strong> en <strong><code>workflow</code></strong> aan.</li>
                                    <li>Kopieer de token.</li>
                                </ul>
                            </li>
                            <li>
                                Stel deze in als secret in Supabase:
                                <pre><code>npx supabase secrets set GITHUB_PAT=jouw_token_hier</code></pre>
                            </li>
                        </ol>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
