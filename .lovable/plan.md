

## DirectAdmin Deployment Export + Build Fix

### 1. Build Error Fix

The edge function `supabase/functions/query-mysql/index.ts` uses `npm:mysql2/promise` which fails in the current Deno environment. This will be fixed by using the `esm.sh` CDN import pattern instead, consistent with the Supabase client import on line 1 of the same file.

**Change:** Replace `import mysql from "npm:mysql2/promise"` with a compatible ESM import.

### 2. DirectAdmin Export Feature

A new component will be added to the Admin Settings that generates a ZIP file containing everything needed to deploy the app on a DirectAdmin (shared hosting) environment. Since this is a Vite/React SPA, the deployment package consists of the production build output plus hosting configuration files.

**What the ZIP will contain:**

| File | Purpose |
|------|---------|
| `public_html/` | All built assets (the Vite production build output, fetched from the published site) |
| `.htaccess` | Apache rewrite rules for SPA routing (all routes to index.html) |
| `README.txt` | Deployment instructions |

**How it works:**

Since we cannot run `vite build` in the browser, the component will:
1. Fetch the published site's `index.html` and parse it for asset references (JS, CSS chunks)
2. Fetch all referenced assets
3. Bundle everything into a ZIP using the existing approach (client-side, using JSZip library)
4. Include a pre-configured `.htaccess` for Apache/DirectAdmin SPA routing
5. Include a `README.txt` with step-by-step deployment instructions

**New dependency:** `jszip` (for creating ZIP files client-side)

### Files

| File | Change |
|------|--------|
| `supabase/functions/query-mysql/index.ts` | Fix mysql2 import for Deno compatibility |
| `src/components/admin/DirectAdminExport.tsx` | **New** -- Component with "Download ZIP" button |
| `src/components/admin/AdminSettings.tsx` | Add DirectAdmin export tab/section under "Database Export" or as new tab |

### Technical Details

**`.htaccess` contents (generated in ZIP):**
```text
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
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
```

**DirectAdminExport component approach:**
- Fetches the published app URL's HTML
- Parses all `<script>` and `<link>` tags to find asset URLs
- Downloads each asset via fetch
- Packages all files into a ZIP using JSZip
- Triggers browser download of the ZIP

**README.txt contents (generated):**
```
SOL Planner - DirectAdmin Deployment
=====================================
1. Upload the contents of the public_html folder to your domain's public_html directory
2. Upload the .htaccess file to the same directory
3. Ensure mod_rewrite is enabled on your hosting
4. Visit your domain to verify the deployment
```

