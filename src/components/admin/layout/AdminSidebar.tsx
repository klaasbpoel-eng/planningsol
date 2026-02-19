import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    ListChecks,
    ClipboardList,
    CalendarDays,
    BookOpen,
    Users,
    Settings,
    Menu,
    X
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdminSidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState(false);

    const navItems = [
        { id: "requests", label: "Aanvragen", icon: ListChecks },
        { id: "tasks", label: "Taken", icon: ClipboardList },
        { id: "calendar", label: "Teamkalender", icon: CalendarDays },
        { id: "logbook", label: "Toolbox Logboek", icon: BookOpen },
        { id: "employees", label: "Medewerkers", icon: Users },
        { id: "settings", label: "Instellingen", icon: Settings },
    ];

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
                    const isActive = activeTab === item.id;

                    return (
                        <Button
                            key={item.id}
                            variant={isActive ? "secondary" : "ghost"}
                            className={cn(
                                "w-full justify-start gap-3 relative transition-all duration-200",
                                isActive
                                    ? "bg-primary/10 text-primary hover:bg-primary/15 font-medium shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                            onClick={() => handleTabChange(item.id)}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                            )}
                            <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                            {item.label}
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
