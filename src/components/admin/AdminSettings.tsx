import { CategoryManagement } from "./CategoryManagement";
import { LeaveTypeManagement } from "./LeaveTypeManagement";
import { GasCylinderSettings } from "./GasCylinderSettings";
import { DryIceSettings } from "./DryIceSettings";
import { DefaultCustomerSetting } from "./DefaultCustomerSetting";
import { UserApprovalManagement } from "./UserApprovalManagement";
import { CustomerManagement } from "../customers/CustomerManagement";
import { EmployeeList } from "./EmployeeList"; // Assuming likely path or fix import below
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Factory, Calendar, Building2, UserCog } from "lucide-react";

export function AdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Instellingen (Vernieuwd)</h2>
        <p className="text-muted-foreground">
          Beheer hier alle systeeminstellingen en configuraties.
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-muted/50 h-auto flex flex-wrap justify-start gap-2 p-1">
          <TabsTrigger value="general" className="gap-2 data-[state=active]:bg-background">
            <Settings className="h-4 w-4" />
            Algemeen
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-background">
            <UserCog className="h-4 w-4" />
            Medewerkers & Toegang
          </TabsTrigger>
          <TabsTrigger value="production" className="gap-2 data-[state=active]:bg-background">
            <Factory className="h-4 w-4" />
            Productie
          </TabsTrigger>
          <TabsTrigger value="planning" className="gap-2 data-[state=active]:bg-background">
            <Calendar className="h-4 w-4" />
            Planning & Verlof
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2 data-[state=active]:bg-background">
            <Building2 className="h-4 w-4" />
            Klanten
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 animate-fade-in-up">
          <div className="grid gap-4">
            <DefaultCustomerSetting />
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4 animate-fade-in-up">
          <div className="grid gap-6">
            {/* Employee List Section */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Medewerkerslijst</h3>
              <p className="text-sm text-muted-foreground">Overzicht van alle actieve en inactieve medewerkers.</p>
              <EmployeeList />
            </div>

            {/* Approval Section */}
            <div className="space-y-2 pt-4 border-t">
              <h3 className="text-lg font-medium">Nieuwe Aanmeldingen</h3>
              <p className="text-sm text-muted-foreground">Keur nieuwe accountaanvragen goed of wijs ze af.</p>
              <UserApprovalManagement />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="production" className="space-y-4 animate-fade-in-up">
          <GasCylinderSettings />
          <DryIceSettings />
        </TabsContent>

        <TabsContent value="planning" className="space-y-4 animate-fade-in-up">
          <CategoryManagement />
          <LeaveTypeManagement />
        </TabsContent>

        <TabsContent value="customers" className="space-y-4 animate-fade-in-up">
          <CustomerManagement isAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}
