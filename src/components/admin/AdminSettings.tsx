import { CategoryManagement } from "./CategoryManagement";
import { LeaveTypeManagement } from "./LeaveTypeManagement";
import { GasCylinderSettings } from "./GasCylinderSettings";
import { DryIceSettings } from "./DryIceSettings";
import { DefaultCustomerSetting } from "./DefaultCustomerSetting";
import { UserApprovalManagement } from "./UserApprovalManagement";
import { CustomerManagement } from "../customers/CustomerManagement";

export function AdminSettings() {
  return (
    <div className="space-y-6">
      <UserApprovalManagement />
      <CategoryManagement />
      <LeaveTypeManagement />
      <GasCylinderSettings />
      <DryIceSettings />
      <DefaultCustomerSetting />
      <CustomerManagement isAdmin />
    </div>
  );
}
