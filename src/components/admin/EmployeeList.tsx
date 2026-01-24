import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users, Edit, Mail, Phone, MapPin, Briefcase, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeDetailDialog } from "./EmployeeDetailDialog";
import { EmployeeLeaveBalances } from "./EmployeeLeaveBalances";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  department?: string | null;
  job_title?: string | null;
  phone?: string | null;
  hire_date?: string | null;
  manager_id?: string | null;
  location?: string | null;
  employment_type?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
};

export function EmployeeList() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filteredEmployees = employees.filter(emp => {
    const search = searchTerm.toLowerCase();
    return (
      emp.full_name?.toLowerCase().includes(search) ||
      emp.email?.toLowerCase().includes(search) ||
      emp.department?.toLowerCase().includes(search) ||
      emp.job_title?.toLowerCase().includes(search) ||
      emp.location?.toLowerCase().includes(search)
    );
  });

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getEmploymentTypeBadge = (type: string | null | undefined) => {
    switch (type) {
      case "full-time":
        return <Badge variant="default" className="bg-success/10 text-success border-success/20">Full-time</Badge>;
      case "part-time":
        return <Badge variant="secondary">Part-time</Badge>;
      case "contract":
        return <Badge variant="outline">Contract</Badge>;
      case "intern":
        return <Badge variant="outline" className="bg-primary/10 text-primary">Intern</Badge>;
      default:
        return null;
    }
  };

  const handleEditEmployee = (employee: Profile) => {
    setSelectedEmployee(employee);
    setDetailDialogOpen(true);
  };

  const handleManageLeaveBalances = (employee: Profile) => {
    setSelectedEmployee(employee);
    setBalanceDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading employees...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-md border-0">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employees ({filteredEmployees.length})
            </CardTitle>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, department, job title, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? "No employees match your search" : "No employees found"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hire Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                              {getInitials(employee.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{employee.full_name || "Unknown"}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {employee.email || "No email"}
                            </div>
                            {employee.job_title && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Briefcase className="h-3 w-3" />
                                {employee.job_title}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {employee.department ? (
                          <div className="flex items-center gap-1.5">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {employee.department}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.location ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {employee.location}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getEmploymentTypeBadge(employee.employment_type)}
                      </TableCell>
                      <TableCell>
                        {employee.hire_date ? (
                          format(new Date(employee.hire_date), "MMM d, yyyy")
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleManageLeaveBalances(employee)}
                          >
                            Leave Balances
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditEmployee(employee)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EmployeeDetailDialog
        employee={selectedEmployee}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onUpdate={fetchEmployees}
        allEmployees={employees}
      />

      <EmployeeLeaveBalances
        employee={selectedEmployee}
        open={balanceDialogOpen}
        onOpenChange={setBalanceDialogOpen}
      />
    </>
  );
}
