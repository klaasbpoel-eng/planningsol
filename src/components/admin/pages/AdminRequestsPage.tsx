import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, CalendarCheck, XCircle } from "lucide-react";
import { AdminFilters, FilterState } from "@/components/admin/AdminFilters";
import { AdminRequestList } from "@/components/admin/AdminRequestList";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface RequestWithProfile extends TimeOffRequest {
    profiles?: Profile | null;
}

interface AdminRequestsPageProps {
    requests: RequestWithProfile[];
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    employees: Profile[];
    onUpdate: () => void;
}

export function AdminRequestsPage({
    requests,
    filters,
    onFiltersChange,
    employees,
    onUpdate
}: AdminRequestsPageProps) {

    const stats = {
        pending: requests.filter((r) => r.status === "pending").length,
        approved: requests.filter((r) => r.status === "approved").length,
        rejected: requests.filter((r) => r.status === "rejected").length,
        total: requests.length,
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Verlofaanvragen</h2>
                <p className="text-muted-foreground">
                    Beheer en beoordeel verlofaanvragen van medewerkers.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="shadow-sm border bg-card hover:shadow-md transition-all duration-200">
                    <CardContent className="pt-6 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-primary/10">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{stats.total}</p>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Totaal</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border bg-card hover:shadow-md transition-all duration-200">
                    <CardContent className="pt-6 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-warning/10">
                            <Clock className="h-5 w-5 text-warning" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{stats.pending}</p>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">In behandeling</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border bg-card hover:shadow-md transition-all duration-200">
                    <CardContent className="pt-6 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-success/10">
                            <CalendarCheck className="h-5 w-5 text-success" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{stats.approved}</p>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Goedgekeurd</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border bg-card hover:shadow-md transition-all duration-200">
                    <CardContent className="pt-6 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-destructive/10">
                            <XCircle className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{stats.rejected}</p>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Afgewezen</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <AdminFilters
                employees={employees}
                filters={filters}
                onFiltersChange={onFiltersChange}
            />

            {/* Request List */}
            <AdminRequestList
                requests={requests}
                onUpdate={onUpdate}
            />
        </div>
    );
}
