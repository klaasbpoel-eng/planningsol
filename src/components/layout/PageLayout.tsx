import { Header } from "@/components/layout/Header";
import { PageTransition } from "@/components/ui/page-transition";
import type { AppRole } from "@/hooks/useUserPermissions";

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
}: PageLayoutProps) {
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
