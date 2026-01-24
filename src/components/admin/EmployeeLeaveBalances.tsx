import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Calendar, Trash2, Edit2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TimeOffType = Database["public"]["Tables"]["time_off_types"]["Row"];

interface LeaveBalance {
  id: string;
  user_id: string;
  type_id: string;
  annual_allowance: number;
  used_days: number;
  carried_over: number;
  accrual_rate: number;
  year: number;
  time_off_type?: TimeOffType;
}

interface EmployeeLeaveBalancesProps {
  employee: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeLeaveBalances({ employee, open, onOpenChange }: EmployeeLeaveBalancesProps) {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [timeOffTypes, setTimeOffTypes] = useState<TimeOffType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ annual_allowance: 0, carried_over: 0, accrual_rate: 0 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBalance, setNewBalance] = useState({
    type_id: "",
    annual_allowance: 20,
    carried_over: 0,
    accrual_rate: 0,
  });

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const fetchData = async () => {
    if (!employee) return;
    
    setLoading(true);
    try {
      // Fetch time off types
      const { data: typesData, error: typesError } = await supabase
        .from("time_off_types")
        .select("*")
        .eq("is_active", true);

      if (typesError) throw typesError;
      setTimeOffTypes(typesData || []);

      // Fetch balances for this employee and year
      const { data: balancesData, error: balancesError } = await supabase
        .from("employee_leave_balances")
        .select("*")
        .eq("user_id", employee.user_id)
        .eq("year", selectedYear);

      if (balancesError) throw balancesError;

      // Map types to balances
      const balancesWithTypes = (balancesData || []).map(balance => ({
        ...balance,
        time_off_type: typesData?.find(t => t.id === balance.type_id),
      }));

      setBalances(balancesWithTypes);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && employee) {
      fetchData();
    }
  }, [open, employee, selectedYear]);

  const handleAddBalance = async () => {
    if (!employee || !newBalance.type_id) {
      toast.error("Please select a leave type");
      return;
    }

    // Check if balance already exists for this type and year
    const exists = balances.some(b => b.type_id === newBalance.type_id);
    if (exists) {
      toast.error("Balance for this leave type already exists");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("employee_leave_balances")
        .insert({
          user_id: employee.user_id,
          type_id: newBalance.type_id,
          annual_allowance: newBalance.annual_allowance,
          carried_over: newBalance.carried_over,
          accrual_rate: newBalance.accrual_rate,
          year: selectedYear,
        });

      if (error) throw error;

      toast.success("Leave balance added");
      setShowAddForm(false);
      setNewBalance({ type_id: "", annual_allowance: 20, carried_over: 0, accrual_rate: 0 });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBalance = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("employee_leave_balances")
        .update({
          annual_allowance: editForm.annual_allowance,
          carried_over: editForm.carried_over,
          accrual_rate: editForm.accrual_rate,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Balance updated");
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBalance = async (id: string) => {
    if (!confirm("Are you sure you want to delete this leave balance?")) return;

    try {
      const { error } = await supabase
        .from("employee_leave_balances")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Balance deleted");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const startEdit = (balance: LeaveBalance) => {
    setEditingId(balance.id);
    setEditForm({
      annual_allowance: balance.annual_allowance,
      carried_over: balance.carried_over,
      accrual_rate: balance.accrual_rate,
    });
  };

  const availableTypes = timeOffTypes.filter(
    type => !balances.some(b => b.type_id === type.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Leave Balances - {employee?.full_name || employee?.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Year selector */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Year</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-32 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {availableTypes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Balance
              </Button>
            )}
          </div>

          {/* Add new balance form */}
          {showAddForm && (
            <Card className="border-dashed">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Leave Type</Label>
                    <Select
                      value={newBalance.type_id}
                      onValueChange={(value) => setNewBalance(prev => ({ ...prev, type_id: value }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {availableTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: type.color }}
                              />
                              {type.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Annual Allowance (days)</Label>
                    <Input
                      type="number"
                      value={newBalance.annual_allowance}
                      onChange={(e) => setNewBalance(prev => ({ ...prev, annual_allowance: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Carried Over (days)</Label>
                    <Input
                      type="number"
                      value={newBalance.carried_over}
                      onChange={(e) => setNewBalance(prev => ({ ...prev, carried_over: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Accrual Rate (days/month)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newBalance.accrual_rate}
                      onChange={(e) => setNewBalance(prev => ({ ...prev, accrual_rate: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddBalance} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Balances list */}
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : balances.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No leave balances set for {selectedYear}
            </div>
          ) : (
            <div className="space-y-3">
              {balances.map((balance) => (
                <Card key={balance.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: balance.time_off_type?.color || "#888" }}
                        />
                        <span className="font-medium">
                          {balance.time_off_type?.name || "Unknown Type"}
                        </span>
                      </div>
                      
                      {editingId === balance.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUpdateBalance(balance.id)}
                            disabled={saving}
                          >
                            <Check className="h-4 w-4 text-success" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(balance)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteBalance(balance.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {editingId === balance.id ? (
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Annual Allowance</Label>
                          <Input
                            type="number"
                            value={editForm.annual_allowance}
                            onChange={(e) => setEditForm(prev => ({ ...prev, annual_allowance: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Carried Over</Label>
                          <Input
                            type="number"
                            value={editForm.carried_over}
                            onChange={(e) => setEditForm(prev => ({ ...prev, carried_over: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Accrual Rate</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={editForm.accrual_rate}
                            onChange={(e) => setEditForm(prev => ({ ...prev, accrual_rate: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total: </span>
                          <span className="font-medium">
                            {balance.annual_allowance + balance.carried_over} days
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Used: </span>
                          <span className="font-medium">{balance.used_days} days</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Remaining: </span>
                          <span className="font-medium text-success">
                            {balance.annual_allowance + balance.carried_over - balance.used_days} days
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Accrual: </span>
                          <span className="font-medium">{balance.accrual_rate}/mo</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
