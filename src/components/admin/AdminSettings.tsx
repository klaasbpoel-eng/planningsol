import { CategoryManagement } from "./CategoryManagement";
import { LeaveTypeManagement } from "./LeaveTypeManagement";
import { GasCylinderSettings } from "./GasCylinderSettings";
import { DefaultCustomerSetting } from "./DefaultCustomerSetting";

export function AdminSettings() {
  return (
    <div className="space-y-6">
      <CategoryManagement />
      <LeaveTypeManagement />
      <GasCylinderSettings />
      <DefaultCustomerSetting />
    </div>
  );
}
