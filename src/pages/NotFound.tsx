import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import siteLogo from "@/assets/site_logo.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PageTransition>
      <div className="flex min-h-screen items-center justify-center bg-muted px-4">
        <div className="text-center space-y-6">
          <img src={siteLogo} alt="SOL Group Logo" className="h-16 w-auto mx-auto" />
          <div>
            <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
            <p className="text-xl text-muted-foreground">Oeps! Pagina niet gevonden</p>
          </div>
          <Button asChild>
            <a href="/">
              <Home className="h-4 w-4 mr-2" />
              Terug naar Home
            </a>
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

export default NotFound;
