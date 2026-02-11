import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import CalendarPage from "./pages/CalendarPage";
import ProductionPlanningPage from "./pages/ProductionPlanningPage";
import InternalOrdersPage from "./pages/InternalOrdersPage";
import NotFound from "./pages/NotFound";
import ToolboxPage from "./pages/ToolboxPage";
import DashboardPage from "./pages/DashboardPage";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>

          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/verlof" element={<DashboardPage />} />
            <Route path="/kalender" element={<CalendarPage />} />
            <Route path="/productie" element={<ProductionPlanningPage />} />
            <Route path="/interne-bestellingen" element={<InternalOrdersPage />} />
            <Route path="/toolbox" element={<ToolboxPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
