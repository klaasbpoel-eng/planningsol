import { ShieldAlert } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PageLayout } from "@/components/layout/PageLayout";
import { SafetyStorage } from "@/components/safety/SafetyStorage";

const SafetyStoragePage = () => (
  <ProtectedRoute>
    {({ user, role, isAdmin, permissions, productionLocation, canViewAllLocations }) => (
      <PageLayout
        userEmail={user.email}
        role={role}
        isAdmin={isAdmin}
        title="PGS-register & opslag"
        description="Gevaarlijke stoffen per opslagplaats en de plattegrond van het terrein"
        titleIcon={<ShieldAlert className="h-8 w-8" />}
      >
        <SafetyStorage
          permissions={permissions}
          userProductionLocation={productionLocation}
          canViewAllLocations={canViewAllLocations}
        />
      </PageLayout>
    )}
  </ProtectedRoute>
);

export default SafetyStoragePage;
