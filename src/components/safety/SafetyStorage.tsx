import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lock, MapPin, ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeletons";
import type { ProductionLocation, RolePermissions } from "@/hooks/useUserPermissions";

const SiteMap = lazy(() => import("@/components/production/SiteMap").then(m => ({ default: m.SiteMap })));
const PGSRegistry = lazy(() => import("@/components/production/PGSRegistry").then(m => ({ default: m.PGSRegistry })));

type LocationFilter = "all" | "sol_emmen" | "sol_tilburg";

const LOCATION_OPTIONS: { value: LocationFilter; label: string }[] = [
  { value: "all", label: "Alle locaties" },
  { value: "sol_emmen", label: "Emmen" },
  { value: "sol_tilburg", label: "Tilburg" },
];

interface SafetyStorageProps {
  permissions: RolePermissions;
  userProductionLocation: ProductionLocation;
  canViewAllLocations: boolean;
}

export function SafetyStorage({ permissions, userProductionLocation, canViewAllLocations }: SafetyStorageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Register for people allowed to see it (own roles can switch it off), floor plan for everyone.
  const canViewRegister = permissions.canViewPGSRegister;
  const defaultTab = canViewRegister ? "register" : "plattegrond";
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab === "plattegrond" || (requestedTab === "register" && canViewRegister) ? requestedTab : defaultTab;

  const [location, setLocation] = useState<LocationFilter>(
    canViewAllLocations ? "all" : ((userProductionLocation as LocationFilter | null) ?? "all")
  );

  useEffect(() => {
    if (!canViewAllLocations && userProductionLocation) setLocation(userProductionLocation as LocationFilter);
  }, [canViewAllLocations, userProductionLocation]);

  const handleTabChange = (tab: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mr-1">Locatie</span>
        {LOCATION_OPTIONS.map(option => {
          const allowed = canViewAllLocations || option.value === location;
          return (
            <Button
              key={option.value}
              size="sm"
              variant={location === option.value ? "default" : "outline"}
              className="h-7 gap-1"
              disabled={!allowed}
              aria-pressed={location === option.value}
              onClick={() => setLocation(option.value)}
            >
              {!allowed && <Lock className="h-3 w-3" />}
              {option.label}
            </Button>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={canViewRegister ? "h-11 p-1" : "hidden"}>
          {canViewRegister && (
            <TabsTrigger value="register" className="gap-2">
              <ShieldAlert className="h-4 w-4" />
              PGS-register
            </TabsTrigger>
          )}
          <TabsTrigger value="plattegrond" className="gap-2">
            <MapPin className="h-4 w-4" />
            Plattegrond
          </TabsTrigger>
        </TabsList>

        {canViewRegister && (
          <TabsContent value="register" className="mt-6">
            <Suspense fallback={<TableSkeleton rows={6} columns={5} />}>
              <PGSRegistry location={location} isAdmin={permissions.canManageUsers} />
            </Suspense>
          </TabsContent>
        )}

        <TabsContent value="plattegrond" className="mt-6">
          <Suspense fallback={<TableSkeleton rows={6} columns={5} />}>
            <SiteMap location={location} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
