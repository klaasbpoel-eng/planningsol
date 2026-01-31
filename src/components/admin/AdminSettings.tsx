import { CategoryManagement } from "./CategoryManagement";
import { LeaveTypeManagement } from "./LeaveTypeManagement";
import { GasCylinderSettings } from "./GasCylinderSettings";
import { DryIceSettings } from "./DryIceSettings";
import { DefaultCustomerSetting } from "./DefaultCustomerSetting";
import { UserApprovalManagement } from "./UserApprovalManagement";

export function AdminSettings() {
  return (
    <div className="space-y-6">
      <UserApprovalManagement />
      <CategoryManagement />
      <LeaveTypeManagement />
      <GasCylinderSettings />
      <DryIceSettings />
      <DefaultCustomerSetting />
    </div>
  );
}
