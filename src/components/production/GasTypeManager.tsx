import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Flame, Plus, Pencil, Trash2, Save, ArrowUp, ArrowDown, ArrowUpDown,
  AlertTriangle, GripVertical, Search, X, MoreHorizontal, Eye, EyeOff,
  Tag, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GasType {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  is_digital: boolean;
  is_external: boolean;
  sort_order: number;
  category_id: string | null;
}

interface GasTypeCategory {
  id: string;
  name: string;
}

interface GasTypeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortColumn = "name" | "description" | "is_active";
type SortDirection = "asc" | "desc";

const COLOR_PRESETS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6b7280",
];

export function GasTypeManager({ open, onOpenChange }: GasTypeManagerProps) {
  const [gasTypes, setGasTypes] = useState<GasType[]>([]);
  const [categories, setCategories] = useState<GasTypeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<GasType | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<GasType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [isActive, setIsActive] = useState(true);
  const [isDigital, setIsDigital] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [digitalFilter, setDigitalFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [draggedTypeId, setDraggedTypeId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchCategories = async () => {
    try {
      const data = await api.gasTypeCategories.getAll();
      // Deduplicate by name (DB may contain duplicate category entries)
      const unique = [...new Map((data || []).map((c: GasTypeCategory) => [c.name, c])).values()] as GasTypeCategory[];
      setCategories(unique);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchGasTypes = async () => {
    try {
      const data = await api.gasTypes.getAllIncludingInactive();
      if (data) {
        const sorted = [...data].sort((a: any, b: any) => {
          const aVal = a[sortColumn];
          const bVal = b[sortColumn];
          if (aVal === bVal) return 0;
          if (aVal === null) return 1;
          if (bVal === null) return -1;
          const comparison = aVal < bVal ? -1 : 1;
          return sortDirection === "asc" ? comparison : -comparison;
        });
        setGasTypes(sorted);
      } else {
        setGasTypes([]);
      }
    } catch (error) {
      console.error("Error fetching gas types:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary" />;
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return null;
    return categories.find(c => c.id === id)?.name ?? null;
  };

  useEffect(() => {
    if (open) {
      fetchGasTypes();
      fetchCategories();
    }
  }, [open, sortColumn, sortDirection]);

  const filteredGasTypes = gasTypes.filter(type => {
    const matchesCategory = categoryFilter === "all" ? true :
      categoryFilter === "none" ? type.category_id === null :
      type.category_id === categoryFilter;
    const matchesSearch = searchQuery.trim() === "" ? true :
      type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (type.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesDigital = !digitalFilter || type.is_digital;
    return matchesCategory && matchesSearch && matchesDigital;
  });

  const openEditDialog = (type: GasType | null) => {
    if (type) {
      setName(type.name);
      setDescription(type.description || "");
      setColor(type.color);
      setIsActive(type.is_active);
      setIsDigital(type.is_digital);
      setIsExternal(type.is_external || false);
      setCategoryId(type.category_id);
    } else {
      setName("");
      setDescription("");
      setColor("#3b82f6");
      setIsActive(true);
      setIsDigital(false);
      setIsExternal(false);
      setCategoryId(null);
    }
    setEditingType(type);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Voer een naam in"); return; }
    setSaving(true);
    const typeData = {
      name: name.trim(),
      description: description.trim() || null,
      color,
      is_active: isActive,
      is_digital: isDigital,
      is_external: isExternal,
      sort_order: editingType ? editingType.sort_order : gasTypes.length,
      category_id: categoryId,
    };
    try {
      if (editingType) {
        await api.gasTypes.update(editingType.id, typeData);
        toast.success("Gastype bijgewerkt");
      } else {
        await api.gasTypes.create(typeData);
        toast.success("Gastype toegevoegd");
      }
      fetchGasTypes();
      setEditDialogOpen(false);
    } catch (error) {
      toast.error("Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    try {
      await api.gasTypes.delete(typeToDelete.id);
      toast.success(`"${typeToDelete.name}" verwijderd`);
      fetchGasTypes();
    } catch (error) {
      toast.error("Fout bij verwijderen");
    }
    setDeleteDialogOpen(false);
    setTypeToDelete(null);
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => api.gasTypes.delete(id)));
      toast.success(`${ids.length} gastype${ids.length > 1 ? "s" : ""} verwijderd`);
      setSelectedIds(new Set());
      fetchGasTypes();
    } catch (error) {
      toast.error("Fout bij verwijderen. Mogelijk zijn ze in gebruik.");
    } finally {
      setDeleting(false);
      setDeleteSelectedDialogOpen(false);
    }
  };

  const handleToggleActive = async (type: GasType) => {
    try {
      await api.gasTypes.update(type.id, { is_active: !type.is_active });
      fetchGasTypes();
    } catch (error) {
      toast.error("Fout bij bijwerken");
    }
  };

  const handleToggleDigital = async (type: GasType) => {
    try {
      await api.gasTypes.update(type.id, { is_digital: !type.is_digital });
      fetchGasTypes();
    } catch (error) {
      toast.error("Fout bij bijwerken");
    }
  };

  const handleDropOnCategory = async (targetCategoryId: string | null) => {
    const idsToMove = draggedTypeId && selectedIds.has(draggedTypeId) && selectedIds.size > 0
      ? Array.from(selectedIds)
      : draggedTypeId ? [draggedTypeId] : [];
    if (idsToMove.length === 0) { setDraggedTypeId(null); setDragOverCategory(null); return; }
    const typesToMove = idsToMove
      .map(id => gasTypes.find(t => t.id === id))
      .filter((t): t is GasType => !!t && t.category_id !== targetCategoryId);
    if (typesToMove.length === 0) { setDraggedTypeId(null); setDragOverCategory(null); return; }
    try {
      await Promise.all(typesToMove.map(t => api.gasTypes.update(t.id, { category_id: targetCategoryId })));
      const catName = targetCategoryId ? categories.find(c => c.id === targetCategoryId)?.name : "Geen categorie";
      toast.success(typesToMove.length === 1
        ? `"${typesToMove[0].name}" verplaatst naar ${catName}`
        : `${typesToMove.length} gastypes verplaatst naar ${catName}`);
      fetchGasTypes();
      setSelectedIds(new Set());
    } catch (error) {
      toast.error("Fout bij bijwerken categorie");
    }
    setDraggedTypeId(null);
    setDragOverCategory(null);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filteredGasTypes.length
      ? new Set()
      : new Set(filteredGasTypes.map(t => t.id)));
  };

  const handleBulkProperty = async (val: string) => {
    const typesToUpdate = Array.from(selectedIds)
      .map(id => gasTypes.find(t => t.id === id))
      .filter((t): t is GasType => !!t);
    if (typesToUpdate.length === 0) return;
    let updates: Partial<GasType> = {};
    if (val === "set_digital") updates = { is_digital: true };
    if (val === "unset_digital") updates = { is_digital: false };
    if (val === "set_external") updates = { is_external: true };
    if (val === "unset_external") updates = { is_external: false };
    if (val === "set_active") updates = { is_active: true };
    if (val === "unset_active") updates = { is_active: false };
    try {
      await Promise.all(typesToUpdate.map(t => api.gasTypes.update(t.id, updates)));
      toast.success(`${typesToUpdate.length} gastype${typesToUpdate.length > 1 ? "s" : ""} bijgewerkt`);
      fetchGasTypes();
    } catch (error) {
      toast.error("Fout bij bijwerken eigenschappen");
    }
  };

  const handleBulkCategory = async (val: string) => {
    const targetCatId = val === "__none__" ? null : val;
    const typesToMove = Array.from(selectedIds)
      .map(id => gasTypes.find(t => t.id === id))
      .filter((t): t is GasType => !!t && t.category_id !== targetCatId);
    if (typesToMove.length === 0) return;
    try {
      await Promise.all(typesToMove.map(t => api.gasTypes.update(t.id, { category_id: targetCatId })));
      const catName = targetCatId ? categories.find(c => c.id === targetCatId)?.name : "Geen categorie";
      toast.success(`${typesToMove.length} gastype${typesToMove.length > 1 ? "s" : ""} verplaatst naar ${catName}`);
      fetchGasTypes();
      setSelectedIds(new Set());
    } catch (error) {
      toast.error("Fout bij bijwerken categorie");
    }
  };

  const activeCount = filteredGasTypes.filter(t => t.is_active).length;
  const inactiveCount = filteredGasTypes.filter(t => !t.is_active).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[1100px] max-h-[90vh] overflow-hidden flex flex-col"
          onInteractOutside={(e) => {
            if (deleteDialogOpen || deleteSelectedDialogOpen || editDialogOpen) e.preventDefault();
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <DialogTitle>Gastypes beheren</DialogTitle>
                <DialogDescription>
                  {gasTypes.length} types · {activeCount} actief
                  {inactiveCount > 0 && <span className="text-muted-foreground/60"> · {inactiveCount} verborgen</span>}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-3 min-h-0 flex-1 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek gastype..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 w-[200px] h-9"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle categorieën</SelectItem>
                    <SelectItem value="none">Geen categorie</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => setDigitalFilter(v => !v)}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors ${
                    digitalFilter
                      ? "bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-950/40 dark:border-sky-700 dark:text-sky-300"
                      : "bg-background border-input text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${digitalFilter ? "bg-sky-500" : "bg-muted-foreground/40"}`} />
                  Digitaal
                </button>
              </div>
              <Button size="sm" onClick={() => openEditDialog(null)} className="gap-2">
                <Plus className="h-4 w-4" />
                Nieuw gastype
              </Button>
            </div>

            {/* Selection bar */}
            {selectedIds.size > 0 && !draggedTypeId && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/8 border border-primary/20 text-sm flex-wrap shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground">
                    {selectedIds.size}
                  </div>
                  <span className="font-medium">geselecteerd</span>
                </div>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  <Select onValueChange={handleBulkProperty}>
                    <SelectTrigger className="h-8 w-[150px] text-xs bg-background">
                      <SelectValue placeholder="Eigenschap…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="set_active">Zichtbaar maken</SelectItem>
                      <SelectItem value="unset_active">Verbergen</SelectItem>
                      <SelectItem value="set_digital">Markeer als digitaal</SelectItem>
                      <SelectItem value="unset_digital">Verwijder digitaal</SelectItem>
                      <SelectItem value="set_external">Markeer als extern</SelectItem>
                      <SelectItem value="unset_external">Verwijder extern</SelectItem>
                    </SelectContent>
                  </Select>
                  {categories.length > 0 && (
                    <Select onValueChange={handleBulkCategory}>
                      <SelectTrigger className="h-8 w-[160px] text-xs bg-background">
                        <SelectValue placeholder="Categorie…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Geen categorie</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setDeleteSelectedDialogOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Verwijderen
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Deselecteren
                  </button>
                </div>
              </div>
            )}

            {/* Drag drop zones */}
            {draggedTypeId && (
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 shrink-0">
                <p className="w-full text-xs font-medium text-muted-foreground mb-1">
                  Sleep naar een categorie:
                </p>
                {[{ id: "__none__", name: "Geen categorie" }, ...categories.map(c => ({ id: c.id, name: c.name }))].map(cat => (
                  <div
                    key={cat.id}
                    onDragOver={(e) => { e.preventDefault(); setDragOverCategory(cat.id); }}
                    onDragLeave={() => setDragOverCategory(null)}
                    onDrop={(e) => { e.preventDefault(); handleDropOnCategory(cat.id === "__none__" ? null : cat.id); }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all cursor-copy",
                      dragOverCategory === cat.id
                        ? "border-primary bg-primary text-primary-foreground scale-105"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {cat.name}
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-y-auto rounded-lg border min-h-0">
              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : filteredGasTypes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Flame className="h-8 w-8 opacity-20" />
                  <p className="text-sm">
                    {searchQuery || categoryFilter !== "all" || digitalFilter ? "Geen resultaten gevonden" : "Geen gastypes"}
                  </p>
                  {(searchQuery || categoryFilter !== "all" || digitalFilter) && (
                    <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setDigitalFilter(false); }}>
                      Filter wissen
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={filteredGasTypes.length > 0 && selectedIds.size === filteredGasTypes.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Selecteer alles"
                        />
                      </TableHead>
                      <TableHead className="w-12" />
                      <TableHead
                        className="cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center">Naam <SortIcon column="name" /></div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-foreground select-none hidden md:table-cell"
                        onClick={() => handleSort("description")}
                      >
                        <div className="flex items-center">Omschrijving <SortIcon column="description" /></div>
                      </TableHead>
                      <TableHead className="w-28">Extern</TableHead>
                      <TableHead className="w-32 hidden sm:table-cell">Categorie</TableHead>
                      <TableHead
                        className="w-24 cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("is_active")}
                      >
                        <div className="flex items-center">Zichtbaar <SortIcon column="is_active" /></div>
                      </TableHead>
                      <TableHead className="w-24 text-muted-foreground">Digitaal</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGasTypes.map((type) => {
                      const isSelected = selectedIds.has(type.id);
                      const isDragging = draggedTypeId === type.id || (draggedTypeId && isSelected && selectedIds.has(draggedTypeId));
                      const categoryName = getCategoryName(type.category_id);
                      return (
                        <TableRow
                          key={type.id}
                          draggable
                          onDragStart={(e) => {
                            if (!isSelected) setSelectedIds(new Set([type.id]));
                            setDraggedTypeId(type.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => { setDraggedTypeId(null); setDragOverCategory(null); }}
                          className={cn(
                            "group cursor-grab active:cursor-grabbing transition-opacity",
                            isDragging && "opacity-40",
                            isSelected && !draggedTypeId && "bg-primary/5",
                            !type.is_active && !isSelected && "opacity-50"
                          )}
                        >
                          <TableCell className="pl-4">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(type.id)}
                              aria-label={`Selecteer ${type.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                              <div
                                className="w-7 h-7 rounded-full border-2 border-white shadow-sm ring-1 ring-border/50 flex-shrink-0"
                                style={{ backgroundColor: type.color }}
                                title={type.color}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={cn("font-medium", !type.is_active && "text-muted-foreground")}>
                              {type.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm hidden md:table-cell max-w-[200px] truncate">
                            {type.description && type.description !== type.name ? type.description : (
                              <span className="opacity-30">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {type.is_external ? (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-purple-300/50 text-purple-600 bg-purple-50 dark:bg-purple-950/30">
                                Extern
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {categoryName ? (
                              <Badge variant="secondary" className="text-xs font-normal">
                                {categoryName}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={type.is_active}
                              onCheckedChange={() => handleToggleActive(type)}
                              aria-label={`${type.name} zichtbaar`}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={type.is_digital}
                              onCheckedChange={() => handleToggleDigital(type)}
                              aria-label={`${type.name} digitaal`}
                            />
                          </TableCell>
                          <TableCell className="pr-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity data-[state=open]:opacity-100"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(type)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Bewerken
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleActive(type)}>
                                  {type.is_active
                                    ? <><EyeOff className="h-4 w-4 mr-2" />Verbergen</>
                                    : <><Eye className="h-4 w-4 mr-2" />Zichtbaar maken</>
                                  }
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => { setTypeToDelete(type); setDeleteDialogOpen(true); }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Verwijderen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Footer count */}
            {!loading && filteredGasTypes.length > 0 && (
              <p className="text-xs text-muted-foreground shrink-0">
                {filteredGasTypes.length} van {gasTypes.length} gastypes
                {(searchQuery || categoryFilter !== "all" || digitalFilter) && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setDigitalFilter(false); }}
                    className="ml-2 text-primary hover:underline"
                  >
                    Filter wissen
                  </button>
                )}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Sluiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingType ? (
                <>
                  <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: color }} />
                  Bewerken
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Nieuw gastype
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="typeName">
                Naam <span className="text-destructive">*</span>
              </Label>
              <Input
                id="typeName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="bijv. Stikstof 5.0"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="typeDescription">Omschrijving</Label>
              <Textarea
                id="typeDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionele omschrijving..."
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Kleur</Label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="sr-only"
                    id="colorPicker"
                  />
                  <label
                    htmlFor="colorPicker"
                    className="block w-10 h-10 rounded-lg border-2 border-border cursor-pointer shadow-sm ring-2 ring-offset-1 ring-transparent hover:ring-border/50 transition-all"
                    style={{ backgroundColor: color }}
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                        color === c ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="w-24 font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Categorie</Label>
              <Select
                value={categoryId || "none"}
                onValueChange={(v) => setCategoryId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen categorie</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              {[
                { key: "isDigital", label: "Digitaal gevuld", desc: "Wordt alleen administratief geboekt", value: isDigital, onChange: setIsDigital },
                { key: "isExternal", label: "Extern", desc: "Wordt gefilterd uit vulcijfers", value: isExternal, onChange: setIsExternal },
                { key: "isActive", label: "Zichtbaar", desc: "Tonen in bestelformulieren", value: isActive, onChange: setIsActive },
              ].map(({ key, label, desc, value, onChange }) => (
                <div
                  key={key}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-colors",
                    value ? "bg-muted/40 border-border" : "bg-transparent"
                  )}
                >
                  <div>
                    <p className="text-sm font-medium leading-none">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <Switch checked={value} onCheckedChange={onChange} />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Opslaan..." : (
                <><Save className="h-4 w-4 mr-2" />Opslaan</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete single */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gastype verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je <strong>"{typeToDelete?.name}"</strong> wilt verwijderen?
              Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete selected */}
      <AlertDialog open={deleteSelectedDialogOpen} onOpenChange={setDeleteSelectedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {selectedIds.size} gastype{selectedIds.size > 1 ? "s" : ""} verwijderen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Verwijderen..." : `Verwijder ${selectedIds.size} gastype${selectedIds.size > 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
