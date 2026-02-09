import { useState } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const PUBLISHED_URL = "https://planningsol.lovable.app";

const HTACCESS_CONTENT = `RewriteEngine On
RewriteBase /
RewriteRule ^index\\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Enable gzip compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 month"
  ExpiresByType image/svg+xml "access plus 1 month"
</IfModule>
`;

const README_CONTENT = `SOL Planner - DirectAdmin Deployment
=====================================

Instructies:

1. Upload alle bestanden uit de public_html map naar de public_html directory van je domein
2. Upload het .htaccess bestand naar dezelfde directory
3. Zorg ervoor dat mod_rewrite is ingeschakeld op je hosting
4. Bezoek je domein om de deployment te verifiëren

Opmerkingen:
- Dit is een Single Page Application (SPA). Het .htaccess bestand zorgt ervoor
  dat alle routes correct worden afgehandeld door index.html.
- Zorg dat je hosting Apache met mod_rewrite ondersteunt.
- De app maakt verbinding met de backend via de geconfigureerde API URL's.
`;

type ExportStatus = "idle" | "fetching" | "downloading" | "zipping" | "done" | "error";

export function DirectAdminExport() {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const extractAssetUrls = (html: string, baseUrl: string): string[] => {
    const urls: string[] = [];
    // Match script src and link href
    const scriptMatches = html.matchAll(/<script[^>]+src=["']([^"']+)["']/g);
    for (const m of scriptMatches) urls.push(m[1]);

    const linkMatches = html.matchAll(/<link[^>]+href=["']([^"']+)["']/g);
    for (const m of linkMatches) {
      // Only include CSS and icons, not external resources
      const href = m[1];
      if (!href.startsWith("http") || href.startsWith(baseUrl)) {
        urls.push(href);
      }
    }

    // Match any other referenced assets in the HTML (favicons, images, etc.)
    const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/g);
    for (const m of imgMatches) {
      if (!m[1].startsWith("data:")) urls.push(m[1]);
    }

    return [...new Set(urls)];
  };

  const resolveUrl = (url: string, baseUrl: string): string => {
    if (url.startsWith("http")) return url;
    if (url.startsWith("/")) return `${baseUrl}${url}`;
    return `${baseUrl}/${url}`;
  };

  const getPathFromUrl = (url: string, baseUrl: string): string => {
    const resolved = resolveUrl(url, baseUrl);
    try {
      const parsed = new URL(resolved);
      return parsed.pathname.startsWith("/") ? parsed.pathname.slice(1) : parsed.pathname;
    } catch {
      return url.startsWith("/") ? url.slice(1) : url;
    }
  };

  const handleExport = async () => {
    setStatus("fetching");
    setProgress(10);
    setError(null);

    try {
      // 1. Fetch index.html
      const indexRes = await fetch(PUBLISHED_URL);
      if (!indexRes.ok) throw new Error(`Kan de gepubliceerde site niet ophalen (${indexRes.status}). Zorg dat de app is gepubliceerd.`);
      let indexHtml = await indexRes.text();
      setProgress(20);

      // 2. Parse asset URLs
      const assetUrls = extractAssetUrls(indexHtml, PUBLISHED_URL);
      setStatus("downloading");

      // 3. Download all assets
      const zip = new JSZip();
      const publicHtml = zip.folder("public_html")!;

      const totalAssets = assetUrls.length;
      let downloaded = 0;

      for (const url of assetUrls) {
        try {
          const fullUrl = resolveUrl(url, PUBLISHED_URL);
          const res = await fetch(fullUrl);
          if (!res.ok) {
            console.warn(`Kon asset niet downloaden: ${fullUrl} (${res.status})`);
            continue;
          }
          const blob = await res.blob();
          const path = getPathFromUrl(url, PUBLISHED_URL);
          publicHtml.file(path, blob);
          downloaded++;
          setProgress(20 + Math.round((downloaded / totalAssets) * 60));
        } catch (e) {
          console.warn(`Fout bij downloaden van ${url}:`, e);
        }
      }

      // 4. Add index.html
      publicHtml.file("index.html", indexHtml);
      setProgress(85);

      // 5. Add .htaccess and README
      setStatus("zipping");
      publicHtml.file(".htaccess", HTACCESS_CONTENT);
      zip.file("README.txt", README_CONTENT);
      setProgress(90);

      // 6. Generate and download ZIP
      const blob = await zip.generateAsync({ type: "blob" });
      setProgress(100);

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `sol-planner-directadmin-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      setStatus("done");
      toast.success("ZIP bestand gedownload!");
    } catch (e: any) {
      console.error("Export error:", e);
      setError(e.message || "Er is een onbekende fout opgetreden.");
      setStatus("error");
      toast.error("Export mislukt");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          DirectAdmin Export
        </CardTitle>
        <CardDescription>
          Download een ZIP bestand met alle bestanden om de app te deployen op een DirectAdmin (shared hosting) omgeving.
          De app moet eerst gepubliceerd zijn.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "error" && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {status === "done" && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription>
              ZIP bestand succesvol gegenereerd en gedownload! Volg de instructies in het README.txt bestand.
            </AlertDescription>
          </Alert>
        )}

        {(status === "fetching" || status === "downloading" || status === "zipping") && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {status === "fetching" && "Gepubliceerde site ophalen..."}
              {status === "downloading" && "Assets downloaden..."}
              {status === "zipping" && "ZIP bestand genereren..."}
            </p>
            <Progress value={progress} />
          </div>
        )}

        <Button
          onClick={handleExport}
          disabled={status === "fetching" || status === "downloading" || status === "zipping"}
        >
          {(status === "fetching" || status === "downloading" || status === "zipping") ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Bezig met exporteren...</>
          ) : (
            <><Download className="h-4 w-4" /> Download DirectAdmin ZIP</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
