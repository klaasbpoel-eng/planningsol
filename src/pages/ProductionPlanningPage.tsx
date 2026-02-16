import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PageLayout } from "@/components/layout/PageLayout";
import { ProductionPlanning } from "@/components/production/ProductionPlanning";

const ProductionPlanningPage = () => (
  <ProtectedRoute>
    {({ role, permissions, productionLocation, canViewAllLocations }) => (
      <PageLayout
        role={role}
        title="Productieplanning"
        description="Plan en beheer de productie van droogijs en gascilinders"
      >
        <ProductionPlanning
          userProductionLocation={productionLocation}
          canViewAllLocations={canViewAllLocations}
          permissions={permissions}
        />
      </PageLayout>
    )}
  </ProtectedRoute>
);

export default ProductionPlanningPage;
