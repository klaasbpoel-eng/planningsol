import { createContext, useContext, useState, ReactNode } from "react";

interface DashboardContextType {
    showAdminView: boolean;
    setShowAdminView: (show: boolean) => void;
    toggleView: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
    const [showAdminView, setShowAdminView] = useState(false);

    const toggleView = () => setShowAdminView((prev) => !prev);

    return (
        <DashboardContext.Provider value={{ showAdminView, setShowAdminView, toggleView }}>
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {
    const context = useContext(DashboardContext);
    if (context === undefined) {
        throw new Error("useDashboard must be used within a DashboardProvider");
    }
    return context;
}
