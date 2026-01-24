import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, User, Briefcase, Phone, MapPin, Heart, Calendar as CalendarIconLucide } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

interface EmployeeDetailDialogProps {
  employee: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  allEmployees: Profile[];
}

export function EmployeeDetailDialog({ 
  employee, 
  open, 
  onOpenChange, 
  onUpdate,
  allEmployees 
}: EmployeeDetailDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    department: "",
    job_title: "",
    phone: "",
    hire_date: undefined as Date | undefined,
    manager_id: "",
    location: "",
    employment_type: "full-time",
    date_of_birth: undefined as Date | undefined,
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        full_name: employee.full_name || "",
        email: employee.email || "",
        department: employee.department || "",
        job_title: employee.job_title || "",
        phone: employee.phone || "",
        hire_date: employee.hire_date ? new Date(employee.hire_date) : undefined,
        manager_id: employee.manager_id || "",
        location: employee.location || "",
        employment_type: employee.employment_type || "full-time",
        date_of_birth: employee.date_of_birth ? new Date(employee.date_of_birth) : undefined,
        address: employee.address || "",
        emergency_contact_name: employee.emergency_contact_name || "",
        emergency_contact_phone: employee.emergency_contact_phone || "",
      });
    }
  }, [employee]);

  const handleSave = async () => {
    if (!employee) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name || null,
          department: formData.department || null,
          job_title: formData.job_title || null,
          phone: formData.phone || null,
          hire_date: formData.hire_date ? format(formData.hire_date, "yyyy-MM-dd") : null,
          manager_id: formData.manager_id || null,
          location: formData.location || null,
          employment_type: formData.employment_type || "full-time",
          date_of_birth: formData.date_of_birth ? format(formData.date_of_birth, "yyyy-MM-dd") : null,
          address: formData.address || null,
          emergency_contact_name: formData.emergency_contact_name || null,
          emergency_contact_phone: formData.emergency_contact_phone || null,
        })
        .eq("id", employee.id);

      if (error) throw error;
      
      toast.success("Employee details updated");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const managers = allEmployees.filter(e => e.user_id !== employee?.user_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Employee Details
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic" className="gap-1.5">
              <User className="h-4 w-4" />
              Basic
            </TabsTrigger>
            <TabsTrigger value="work" className="gap-1.5">
              <Briefcase className="h-4 w-4" />
              Work
            </TabsTrigger>
            <TabsTrigger value="personal" className="gap-1.5">
              <Heart className="h-4 w-4" />
              Personal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="New York, NY"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="work" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="Engineering"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                  placeholder="Software Engineer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hire Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.hire_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.hire_date ? format(formData.hire_date, "MMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.hire_date}
                      onSelect={(date) => setFormData(prev => ({ ...prev, hire_date: date }))}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select
                  value={formData.employment_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, employment_type: value }))}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Manager</Label>
              <Select
                value={formData.manager_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, manager_id: value === "none" ? "" : value }))}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="none">No manager</SelectItem>
                  {managers.map((mgr) => (
                    <SelectItem key={mgr.id} value={mgr.id}>
                      {mgr.full_name || mgr.email || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="personal" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.date_of_birth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date_of_birth ? format(formData.date_of_birth, "MMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.date_of_birth}
                      onSelect={(date) => setFormData(prev => ({ ...prev, date_of_birth: date }))}
                      initialFocus
                      className="pointer-events-auto"
                      captionLayout="dropdown-buttons"
                      fromYear={1950}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main St, City, State 12345"
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Heart className="h-4 w-4 text-destructive" />
                Emergency Contact
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_name">Contact Name</Label>
                  <Input
                    id="emergency_contact_name"
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                  <Input
                    id="emergency_contact_phone"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
