import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DatabaseExportSettings } from "./DatabaseExportSettings";

const AVAILABLE_TABLES = [
  "app_settings",
  "gas_type_categories",
  "cylinder_sizes",
  "dry_ice_packaging",
  "dry_ice_product_types",
  "task_types",
  "time_off_types",
  "gas_types",
  "customers",
  "gas_cylinder_orders",
  "dry_ice_orders",
];

export function MigrationSettings() {
  const [selectedTables, setSelectedTables] = useState<string[]>(AVAILABLE_TABLES);

  const handleToggleTable = (table: string) => {
    setSelectedTables(prev =>
      prev.includes(table) ? prev.filter(t => t !== table) : [...prev, table]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedTables(checked ? AVAILABLE_TABLES : []);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tabellen Selecteren</CardTitle>
          <CardDescription>Welke tabellen wilt u exporteren?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox
              id="select-all"
              checked={selectedTables.length === AVAILABLE_TABLES.length}
              onCheckedChange={handleSelectAll}
            />
            <Label htmlFor="select-all" className="font-bold">Alles Selecteren</Label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {AVAILABLE_TABLES.map(table => (
              <div key={table} className="flex items-center space-x-2">
                <Checkbox
                  id={table}
                  checked={selectedTables.includes(table)}
                  onCheckedChange={() => handleToggleTable(table)}
                />
                <Label htmlFor={table}>{table}</Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <DatabaseExportSettings selectedTables={selectedTables} />
    </div>
  );
}
