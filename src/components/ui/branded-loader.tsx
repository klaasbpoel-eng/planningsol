import siteLogo from "@/assets/site_logo.png";

export function BrandedLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <img src={siteLogo} alt="SOL Group" className="h-12 w-auto animate-pulse" />
      <span className="text-sm text-muted-foreground font-medium">Laden...</span>
    </div>
  );
}
