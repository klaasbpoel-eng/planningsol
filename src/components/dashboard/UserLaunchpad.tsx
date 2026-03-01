import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, Calendar, ShoppingCart, Wrench, Clock, Shield, ArrowRight, ScanBarcode, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DailyOverview } from "./DailyOverview";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

import type { RolePermissions, AppRole } from "@/hooks/useUserPermissions";

interface UserLaunchpadProps {
    userEmail?: string;
    isAdmin?: boolean;
    permissions?: RolePermissions;
    role?: AppRole;
    onSwitchToAdmin: () => void;
}

interface LiveStats {
    pendingTasks: number;
    todayOrders: number;
    pendingLeave: number;
}

export function UserLaunchpad({ userEmail, isAdmin, permissions, role, onSwitchToAdmin }: UserLaunchpadProps) {
    const navigate = useNavigate();
    const [stats, setStats] = useState<LiveStats>({ pendingTasks: 0, todayOrders: 0, pendingLeave: 0 });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const today = format(new Date(), "yyyy-MM-dd");
            const [tasksRes, ordersRes, leaveRes] = await Promise.all([
                supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["pending", "in_progress"]),
                supabase.from("gas_cylinder_orders").select("id", { count: "exact", head: true }).eq("scheduled_date", today),
                supabase.from("time_off_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
            ]);
            setStats({
                pendingTasks: tasksRes.count || 0,
                todayOrders: ordersRes.count || 0,
                pendingLeave: leaveRes.count || 0,
            });
        } catch (e) {
            console.error("Stats fetch error:", e);
        }
    };

    const features = [
        {
            title: "Productieplanning",
            description: "Beheer productieorders en gasflessen",
            icon: <Factory className="h-8 w-8 text-primary" />,
            path: "/productie",
            enabled: permissions?.canViewOrders,
            color: "bg-primary/10 hover:bg-primary/20",
            stat: stats.todayOrders > 0 ? `${stats.todayOrders} orders vandaag` : undefined,
            hero: true,
        },
        {
            title: "Kalender",
            description: "Bekijk de productieplanning in kalenderweergave",
            icon: <Calendar className="h-8 w-8 text-accent" />,
            path: "/kalender",
            enabled: true,
            color: "bg-accent/10 hover:bg-accent/20",
            hero: true,
        },
        {
            title: "Dagelijks Overzicht",
            description: "Bekijk alle taken, orders en verlof per dag",
            icon: <CalendarDays className="h-8 w-8 text-primary" />,
            path: "/dagoverzicht",
            enabled: true,
            color: "bg-primary/10 hover:bg-primary/20",
            stat: stats.pendingTasks > 0 ? `${stats.pendingTasks} openstaande taken` : undefined,
            hero: true,
        },
        {
            title: "Interne Bestellingen",
            description: "Plaats en beheer interne bestellingen",
            icon: <ShoppingCart className="h-8 w-8 text-success" />,
            path: "/interne-bestellingen",
            enabled: true,
            color: "bg-success/10 hover:bg-success/20",
        },
        {
            title: "Verlof & Aanvragen",
            description: "Vraag verlof aan en beheer uw uren",
            icon: <Clock className="h-8 w-8 text-warning" />,
            path: "/verlof",
            enabled: true,
            color: "bg-warning/10 hover:bg-warning/20",
            stat: stats.pendingLeave > 0 ? `${stats.pendingLeave} in behandeling` : undefined,
        },
        {
            title: "Toolbox",
            description: "Handige tools en documentatie",
            icon: <Wrench className="h-8 w-8 text-indigo-500" />,
            path: "/toolbox",
            enabled: true,
            color: "bg-indigo-500/10 hover:bg-indigo-500/20",
        },
        {
            title: "Barcode Generator",
            description: "Maak en download 6-karakter barcodes",
            icon: <ScanBarcode className="h-8 w-8 text-muted-foreground" />,
            path: "/barcode",
            enabled: true,
            color: "bg-muted hover:bg-muted/80",
        },
    ];

    return (
        <PageLayout
            userEmail={userEmail}
            role={role}
            title={`Welkom terug${userEmail ? `, ${userEmail.split("@")[0]}` : ""}`}
            description="Kies een module om aan de slag te gaan."
        >
            <DailyOverview />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Admin Card */}
                {isAdmin && (
                    <Card
                        className="group cursor-pointer border-l-4 border-l-destructive hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
                        onClick={onSwitchToAdmin}
                    >
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="p-3 rounded-xl bg-destructive/10 group-hover:bg-destructive/20 transition-colors">
                                    <Shield className="h-8 w-8 text-destructive" />
                                </div>
                            </div>
                            <CardTitle className="mt-4">Beheerpaneel</CardTitle>
                            <CardDescription>
                                Beheer gebruikers, instellingen en goedkeuringen
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-sm font-medium text-destructive mt-2">
                                Open Dashboard <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {features.map((feature, index) => feature.enabled && (
                    <Card
                        key={index}
                        className={cn(
                            "group cursor-pointer border-l-4 border-l-transparent hover:shadow-lg hover:scale-[1.02] transition-all duration-300 hover:border-l-primary",
                            feature.hero && "md:col-span-1 lg:col-span-1"
                        )}
                        onClick={() => navigate(feature.path)}
                    >
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className={`p-3 rounded-xl transition-colors ${feature.color}`}>
                                    {feature.icon}
                                </div>
                                {feature.stat && (
                                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                                        {feature.stat}
                                    </span>
                                )}
                            </div>
                            <CardTitle className="mt-4">{feature.title}</CardTitle>
                            <CardDescription>
                                {feature.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors mt-2">
                                Ga verder <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </PageLayout>
    );
}
