import { Header } from "@/components/layout/Header";
import { PageTransition } from "@/components/ui/page-transition";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useLocation, Link } from "react-router-dom";
import type { AppRole } from "@/hooks/useUserPermissions";

const ROUTE_LABELS: Record<string, string> = {
  "": "Home",
  "kalender": "Kalender",
  "productie": "Productieplanning",
  "interne-bestellingen": "Interne Bestellingen",
  "verlof": "Verlof & Aanvragen",
  "toolbox": "Toolbox",
  "barcode": "Barcode Generator",
  "dagoverzicht": "Dagelijks Overzicht",
};

interface PageLayoutProps {
  userEmail?: string;
  role?: AppRole;
  isAdmin?: boolean;
  onSwitchView?: () => void;
  title?: string;
  description?: string;
  titleIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export function PageLayout({
  userEmail,
  role,
  isAdmin,
  onSwitchView,
  title,
  description,
  titleIcon,
  children,
  className = "",
  breadcrumbs,
}: PageLayoutProps) {
  const location = useLocation();

  // Auto-generate breadcrumbs from route if not provided
  const autoBreadcrumbs = (() => {
    if (breadcrumbs) return breadcrumbs;
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return [];
    return [
      { label: "Home", href: "/" },
      ...segments.map((seg, i) => ({
        label: ROUTE_LABELS[seg] || seg,
        href: i < segments.length - 1 ? "/" + segments.slice(0, i + 1).join("/") : undefined,
      })),
    ];
  })();

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col gradient-mesh overflow-x-hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
        >
          Ga naar hoofdinhoud
        </a>
        <Header userEmail={userEmail} role={role} isAdmin={isAdmin} onSwitchView={onSwitchView} />

        <main id="main-content" className={`flex-1 w-full container mx-auto px-4 py-8 ${className}`}>
          {autoBreadcrumbs.length > 0 && (
            <Breadcrumb className="mb-4">
              <BreadcrumbList>
                {autoBreadcrumbs.map((crumb, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    {i > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.href ? (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </span>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          )}
          {title && (
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gradient flex items-center gap-3">
                {titleIcon}
                {title}
              </h1>
              {description && (
                <p className="text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    </PageTransition>
  );
}
