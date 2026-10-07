import { useNavigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Navigate } from "react-router-dom";

const AdminPage = () => {
  const navigate = useNavigate();

  return (
    <ProtectedRoute>
      {({ user, role, permissions, isAdmin }) =>
        isAdmin ? (
          <AdminDashboard
            userEmail={user.email}
            role={role}
            permissions={permissions}
            onSwitchView={() => navigate("/")}
          />
        ) : (
          <Navigate to="/" replace />
        )
      }
    </ProtectedRoute>
  );
};

export default AdminPage;