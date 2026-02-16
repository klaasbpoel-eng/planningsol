import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PageLayout } from "@/components/layout/PageLayout";
import { CalendarOverview } from "@/components/calendar/CalendarOverview";

const CalendarPage = () => (
  <ProtectedRoute>
    {({ user, role }) => (
      <PageLayout userEmail={user.email} role={role}>
        <CalendarOverview currentUser={user} />
      </PageLayout>
    )}
  </ProtectedRoute>
);

export default CalendarPage;
