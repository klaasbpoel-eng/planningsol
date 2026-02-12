import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Users,
  Trophy,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";
import { FadeIn } from "@/components/ui/fade-in";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface CustomerSegmentationProps {
  location: ProductionLocation;
  refreshKey?: number;
}

interface CustomerSegment {
  customer_id: string;
  customer_name: string;
  total_cylinders: number;
  total_dry_ice_kg: number;
  order_count: number;
  first_order_date: string;
  last_order_date: string;
  avg_order_size: number;
  tier: "gold" | "silver" | "bronze";
  trend: "new" | "growing" | "stable" | "declining";
}

export function CustomerSegmentation({ location, refreshKey = 0 }: CustomerSegmentationProps) {
  const [customers, setCustomers] = useState<CustomerSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchCustomerSegments();
  }, [location, refreshKey]);

  const fetchCustomerSegments = async () => {
    setLoading(true);

    const locationParam = location === "all" ? null : location;

    try {
      const data = await api.reports.getCustomerSegments(currentYear, locationParam);
      if (data) {
        setCustomers(data as CustomerSegment[]);
      }
    } catch (error) {
      console.error("[CustomerSegmentation] Error fetching segments:", error);
    }

    setLoading(false);
  };

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(c =>
      c.customer_name.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const tierStats = useMemo(() => {
    const stats = { gold: 0, silver: 0, bronze: 0 };
    customers.forEach(c => {
      stats[c.tier]++;
    });
    return stats;
  }, [customers]);

  const trendStats = useMemo(() => {
    const stats = { growing: 0, stable: 0, declining: 0, new: 0 };
    customers.forEach(c => {
      stats[c.trend]++;
    });
    return stats;
  }, [customers]);

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "gold": return <Trophy className="h-4 w-4 text-yellow-500" />;
      case "silver": return <Medal className="h-4 w-4 text-slate-400" />;
      case "bronze": return <Award className="h-4 w-4 text-amber-600" />;
      default: return null;
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "gold":
        return (
          <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white border-0">
            <Trophy className="h-3 w-3 mr-1" />
            Gold
          </Badge>
        );
      case "silver":
        return (
          <Badge className="bg-gradient-to-r from-slate-300 to-slate-500 text-white border-0">
            <Medal className="h-3 w-3 mr-1" />
            Silver
          </Badge>
        );
      case "bronze":
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-amber-700 text-white border-0">
            <Award className="h-3 w-3 mr-1" />
            Bronze
          </Badge>
        );
      default:
        return null;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "growing": return <TrendingUp className="h-3 w-3 text-success" />;
      case "declining": return <TrendingDown className="h-3 w-3 text-destructive" />;
      case "stable": return <Minus className="h-3 w-3 text-muted-foreground" />;
      case "new": return <Sparkles className="h-3 w-3 text-primary" />;
      default: return null;
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case "growing": return "Groeiend";
      case "declining": return "Dalend";
      case "stable": return "Stabiel";
      case "new": return "Nieuw";
      default: return trend;
    }
  };

  const getTrendBadgeVariant = (trend: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (trend) {
      case "growing": return "default";
      case "declining": return "destructive";
      case "new": return "secondary";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="glass-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Klant Segmentatie
                  <Badge variant="outline" className="ml-2 text-xs">
                    {customers.length} klanten
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Klantwaarde en gedragsanalyse {currentYear}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <FadeIn show={true}>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {/* Tier Distribution */}
                <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span className="text-xs font-medium">Gold</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-500">{tierStats.gold}</p>
                </div>

                <div className="p-3 rounded-lg bg-gradient-to-br from-slate-400/10 to-slate-400/5 border border-slate-400/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Medal className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-medium">Silver</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-400">{tierStats.silver}</p>
                </div>

                <div className="p-3 rounded-lg bg-gradient-to-br from-amber-600/10 to-amber-600/5 border border-amber-600/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-medium">Bronze</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">{tierStats.bronze}</p>
                </div>

                {/* Risk Alert */}
                <div className={cn(
                  "p-3 rounded-lg border",
                  trendStats.declining > 0
                    ? "bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20"
                    : "bg-gradient-to-br from-success/10 to-success/5 border-success/20"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    {trendStats.declining > 0 ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-success" />
                    )}
                    <span className="text-xs font-medium">
                      {trendStats.declining > 0 ? "Let op" : "Groei"}
                    </span>
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    trendStats.declining > 0 ? "text-destructive" : "text-success"
                  )}>
                    {trendStats.declining > 0 ? trendStats.declining : trendStats.growing}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {trendStats.declining > 0 ? "Dalende klanten" : "Groeiende klanten"}
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek klant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Customer List */}
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {filteredCustomers.map((customer, index) => (
                    <Popover key={customer.customer_id || index}>
                      <PopoverTrigger asChild>
                          <div className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all duration-200",
                            "hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm",
                            customer.tier === "gold" && "border-l-4 border-l-yellow-500",
                            customer.tier === "silver" && "border-l-4 border-l-slate-400",
                            customer.tier === "bronze" && "border-l-4 border-l-amber-600"
                          )}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {getTierIcon(customer.tier)}
                                  <span className="font-medium truncate">
                                    {customer.customer_name}
                                  </span>
                                  <Badge
                                    variant={getTrendBadgeVariant(customer.trend)}
                                    className="text-xs h-5 gap-1"
                                  >
                                    {getTrendIcon(customer.trend)}
                                    {getTrendLabel(customer.trend)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>{formatNumber(customer.total_cylinders, 0)} cilinders</span>
                                  <span>•</span>
                                  <span>{customer.order_count} orders</span>
                                  <span>•</span>
                                  <span>Gem. {formatNumber(customer.avg_order_size, 0)}/order</span>
                                </div>
                              </div>
                              {getTierBadge(customer.tier)}
                            </div>
                          </div>
                      </PopoverTrigger>
                      <PopoverContent side="left" collisionPadding={16} className="max-w-xs">
                          <div className="space-y-2">
                            <p className="font-semibold">{customer.customer_name}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Eerste order:</span>
                                <p>{customer.first_order_date ? format(new Date(customer.first_order_date), "d MMM yyyy", { locale: nl }) : "-"}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Laatste order:</span>
                                <p>{customer.last_order_date ? format(new Date(customer.last_order_date), "d MMM yyyy", { locale: nl }) : "-"}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Droogijs:</span>
                                <p>{formatNumber(customer.total_dry_ice_kg, 0)} kg</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Tier:</span>
                                <p className="capitalize">{customer.tier}</p>
                              </div>
                            </div>
                          </div>
                      </PopoverContent>
                    </Popover>
                  ))}

                  {filteredCustomers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Geen klanten gevonden</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </FadeIn>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
