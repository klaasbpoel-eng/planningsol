import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, Calendar, ShoppingCart, Wrench, Clock, Shield, ArrowRight, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { RolePermissions, AppRole } from "@/hooks/useUserPermissions";

interface UserLaunchpadProps {
    userEmail?: string;
    isAdmin?: boolean;
    permissions?: RolePermissions;
    role?: AppRole;
    onSwitchToAdmin: () => void;
}

export function UserLaunchpad({ userEmail, isAdmin, permissions, role, onSwitchToAdmin }: UserLaunchpadProps) {
    const navigate = useNavigate();

    const features = [
        {
            title: "Productieplanning",
            description: "Beheer productieorders en gasflessen",
            icon: <Factory className="h-8 w-8 text-primary" />,
            path: "/productie",
            enabled: permissions?.canViewOrders,
            color: "bg-primary/10 hover:bg-primary/20",
        },
        {
            title: "Kalender",
            description: "Bekijk de productieplanning in kalenderweergave",
            icon: <Calendar className="h-8 w-8 text-accent" />,
            path: "/kalender",
            enabled: true, // Everyone can see calendar? Or check permission? Assumed true for now based on previous code
            color: "bg-accent/10 hover:bg-accent/20",
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
        },
        {
            title: "Toolbox",
            description: "Handige tools en documentatie",
            icon: <Wrench className="h-8 w-8 text-indigo-500" />,
            path: "/toolbox",
            enabled: true,
            color: "bg-indigo-500/10 hover:bg-indigo-500/20",
        },
    ];

    return (
        <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
            <Header userEmail={userEmail} role={role} />

            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="mb-8 space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Welkom terug{userEmail ? `, ${userEmail.split("@")[0]}` : ""}
                    </h1>
                    <p className="text-muted-foreground">
                        Kies een module om aan de slag te gaan.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Admin Card - Special Case */}
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
                            className={`group cursor-pointer border-l-4 border-l-transparent hover:shadow-lg hover:scale-[1.02] transition-all duration-300 hover:border-l-primary`}
                            onClick={() => navigate(feature.path)}
                        >
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className={`p-3 rounded-xl transition-colors ${feature.color}`}>
                                        {feature.icon}
                                    </div>
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
            </main>
        </div>
    );
}
