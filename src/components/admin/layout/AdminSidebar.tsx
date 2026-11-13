import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { ADMIN_SECTIONS } from "@/config/navigation";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

interface AdminSidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

interface BadgeCounts {
    requests: number;
    employees: number;
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState(false);
    const [badges, setBadges] = useState<BadgeCounts>({ requests: 0, employees: 0 });

    useEffect(() => {
        fetchBadgeCounts();
    }, []);

    const fetchBadgeCounts = async () => {
        try {
            const [requestsRes, profilesRes] = await Promise.all([
                supabase.from("time_off_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
                supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_approved", false),
            ]);
            setBadges({
                requests: requestsRes.count || 0,
                employees: profilesRes.count || 0,
            });
        } catch (e) {
            console.error("Badge count fetch error:", e);
        }
    };

    const badgeKeys: Record<string, keyof BadgeCounts> = { requests: "requests", employees: "employees" };
    const navItems = ADMIN_SECTIONS;

    const handleTabChange = (tabId: string) => {
        onTabChange(tabId);
        if (isMobile) setIsOpen(false);
    };

    const NavContent = () => (
        <div className="flex flex-col h-full bg-card/50 backdrop-blur-sm border-r border-border/50">
            <div className="p-6">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
                    <LayoutDashboard className="h-5 w-5" />
                    Beheer
                </h2>
            </div>
            <div className="flex-1 px-3 py-2 space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.tab !== null && activeTab === item.tab;
                    const badgeKey = item.tab ? badgeKeys[item.tab] : undefined;
                    const badgeCount = badgeKey ? badges[badgeKey] : 0;
                    const itemClass = cn(
                        "w-full justify-start gap-3 relative transition-all duration-200",
                        isActive
                            ? "bg-primary/10 text-primary hover:bg-primary/15 font-medium shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    );

                    if (!item.tab) {
                        return (
                            <Button key={item.id} variant="ghost" className={itemClass} asChild>
                                <Link to={item.path} onClick={() => isMobile && setIsOpen(false)}>
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    {item.label}
                                </Link>
                            </Button>
                        );
                    }

                    return (
                        <Button
                            key={item.id}
                            variant={isActive ? "secondary" : "ghost"}
                            className={itemClass}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => handleTabChange(item.tab!)}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                            )}
                            <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                            {item.label}
                            {badgeCount > 0 && (
                                <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                                    {badgeCount}
                                </span>
                            )}
                        </Button>
                    );
                })}
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72">
                    <NavContent />
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <div className="hidden md:block w-64 shrink-0 h-[calc(100vh-4rem)] sticky top-16">
            <NavContent />
        </div>
    );
}
