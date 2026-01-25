import { CategoryManagement } from "./CategoryManagement";
import { LeaveTypeManagement } from "./LeaveTypeManagement";

export function AdminSettings() {
  return (
    <div className="space-y-6">
      <CategoryManagement />
      <LeaveTypeManagement />
    </div>
  );
}
