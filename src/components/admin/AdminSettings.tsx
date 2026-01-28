import { CategoryManagement } from "./CategoryManagement";
import { LeaveTypeManagement } from "./LeaveTypeManagement";
import { GasCylinderSettings } from "./GasCylinderSettings";
import { DryIceSettings } from "./DryIceSettings";
import { DefaultCustomerSetting } from "./DefaultCustomerSetting";
import { CustomerImport } from "./CustomerImport";

export function AdminSettings() {
  return (
    <div className="space-y-6">
      <CategoryManagement />
      <LeaveTypeManagement />
      <GasCylinderSettings />
      <DryIceSettings />
      <DefaultCustomerSetting />
      <CustomerImport />
    </div>
  );
}
