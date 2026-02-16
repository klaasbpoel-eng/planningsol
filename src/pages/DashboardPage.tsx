import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Dashboard } from "@/components/dashboard/Dashboard";

const DashboardPage = () => (
  <ProtectedRoute>
    {({ user, role, permissions, isAdmin }) => (
      <Dashboard
        userEmail={user.email}
        isAdmin={isAdmin}
        permissions={permissions}
        role={role}
      />
    )}
  </ProtectedRoute>
);

export default DashboardPage;
