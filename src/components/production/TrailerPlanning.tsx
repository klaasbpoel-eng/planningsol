import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Truck, Save, Info, Pencil, Trash2, ZoomIn, ZoomOut, Move, Maximize2, Minimize2, Box } from "lucide-react";
import { cn } from "@/lib/utils";

interface PalletSlot {
    id: string;
    index: number;
    description: string;
    status: 'empty' | 'loaded' | 'reserved';
    content?: string;
}

interface TrailerPlanningProps {
    location?: "sol_emmen" | "sol_tilburg" | "all";
}

export function TrailerPlanning({ location }: TrailerPlanningProps) {
    const [mode, setMode] = useState<"view" | "edit">("view");
    const [pallets, setPallets] = useState<PalletSlot[]>(() => {
        // Initialize 26 slots
        return Array.from({ length: 26 }, (_, i) => ({
            id: `p-${i + 1}`,
            index: i,
            description: `Pallet ${i + 1}`,
            status: 'empty'
        }));
    });

    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);

    // Zoom and Pan Handlers (reused logic)
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isPanning) {
                const deltaX = e.clientX - lastMousePos.current.x;
                const deltaY = e.clientY - lastMousePos.current.y;
                lastMousePos.current = { x: e.clientX, y: e.clientY };

                setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
            }
        };

        const handleGlobalMouseUp = () => {
            setIsPanning(false);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        };

        if (isPanning) {
            window.addEventListener("mousemove", handleGlobalMouseMove);
            window.addEventListener("mouseup", handleGlobalMouseUp);
        }
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove);
            window.removeEventListener("mouseup", handleGlobalMouseUp);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isPanning, isFullscreen]);

    const handleWheel = (e: React.WheelEvent) => {
        // Simple zoom on scroll
        if (true) {
            const delta = -e.deltaY;
            setZoom(prev => {
                const newZoom = prev + delta * 0.001;
                return Math.min(Math.max(newZoom, 0.5), 3);
            });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.defaultPrevented) return;
        if ((e.target as HTMLElement).closest('button, input, .no-drag')) return;

        setIsPanning(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const updatePallet = (id: string, updates: Partial<PalletSlot>) => {
        setPallets(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    };

    const togglePalletStatus = (id: string) => {
        if (mode !== "edit") return;
        setPallets(prev => prev.map(p => {
            if (p.id === id) {
                const nextStatus = p.status === 'empty' ? 'loaded' :
                    p.status === 'loaded' ? 'reserved' : 'empty';
                return { ...p, status: nextStatus };
            }
            return p;
        }));
    };

    return (
        <Card className={cn(
            "glass-card w-full overflow-hidden transition-all duration-300",
            isFullscreen ? "fixed inset-0 z-50 rounded-none h-screen w-screen bg-background/95 backdrop-blur-md" : ""
        )}>
            <CardHeader className="flex flex-row items-center justify-between z-10 relative bg-background/80 backdrop-blur-sm shadow-sm">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-blue-500" />
                        Trailer Laadplan
                    </CardTitle>
                    <CardDescription>
                        {mode === "view"
                            ? "Overzicht van trailer belading (26 pallets)"
                            : "Klik op een palletplaats om status te wijzigen. Klik icoon voor details."}
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-1 mr-4 bg-muted/20 p-1 rounded-md">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}>
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <div className="w-12 text-center text-xs font-mono">{Math.round(zoom * 100)}%</div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(z + 0.2, 3))}>
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-4 bg-border mx-1"></div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }} title="Reset View">
                            <Move className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                        </Button>
                    </div>

                    {mode === "edit" ? (
                        <Button size="sm" onClick={() => setMode("view")}>
                            <Save className="h-4 w-4 mr-2" />
                            Opslaan
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                            Bewerken
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent
                className={cn(
                    "p-0 relative bg-muted/10 min-h-[600px] overflow-hidden select-none",
                    isPanning ? "cursor-grabbing" : "cursor-grab",
                    isFullscreen ? "h-[calc(100vh-80px)]" : ""
                )}
                ref={containerRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
            >
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                    <div className="bg-background/80 backdrop-blur-sm p-2 rounded-lg border shadow-sm text-xs space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-100 border border-green-500 rounded-sm"></div>
                            <span>Leeg</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-100 border border-blue-500 rounded-sm"></div>
                            <span>Geladen</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-100 border border-orange-500 rounded-sm"></div>
                            <span>Gereserveerd</span>
                        </div>
                    </div>
                </div>

                <motion.div
                    ref={mapRef}
                    className="w-full h-full origin-center flex items-center justify-center pt-20"
                    animate={{ scale: zoom, x: pan.x, y: pan.y }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {/* Trailer Chassis Visual */}
                    <div className="relative w-[850px] h-[400px] bg-slate-200 dark:bg-slate-800 rounded-lg border-4 border-slate-400 dark:border-slate-600 shadow-2xl flex items-center justify-center">
                        {/* Cabin Connector (Left Side) */}
                        <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-12 h-4 bg-slate-400"></div>
                        <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-12 h-16 bg-slate-500 rounded-md"></div>

                        {/* Wheels Top (Rear/Right) */}
                        <div className="absolute right-[150px] -top-8 w-16 h-6 bg-black rounded-t-md"></div>
                        <div className="absolute right-[70px] -top-8 w-16 h-6 bg-black rounded-t-md"></div>
                        {/* Wheels Bottom (Rear/Right) */}
                        <div className="absolute right-[150px] -bottom-8 w-16 h-6 bg-black rounded-b-md"></div>
                        <div className="absolute right-[70px] -bottom-8 w-16 h-6 bg-black rounded-b-md"></div>

                        {/* Pallet Grid */}
                        <div className="grid grid-rows-2 grid-flow-col gap-x-4 gap-y-12 p-8 w-full h-full">
                            {pallets.map((pallet) => (
                                <Popover key={pallet.id}>
                                    <PopoverTrigger asChild>
                                        <motion.div
                                            className={cn(
                                                "relative w-full h-full rounded border-2 border-dashed flex flex-col items-center justify-center transition-colors group",
                                                pallet.status === 'empty' && "bg-green-50/50 border-green-200 hover:bg-green-100/50",
                                                pallet.status === 'loaded' && "bg-blue-100 border-blue-500",
                                                pallet.status === 'reserved' && "bg-orange-100 border-orange-500",
                                                mode === 'edit' && "cursor-pointer hover:scale-105 active:scale-95 no-drag"
                                            )}
                                            onClick={() => togglePalletStatus(pallet.id)}
                                        >
                                            <div className="absolute top-1 left-2 text-[10px] text-muted-foreground font-mono">
                                                {pallet.index + 1}
                                            </div>

                                            {pallet.status === 'empty' ? (
                                                <div className="text-muted-foreground/30 font-medium text-xs">LEEG</div>
                                            ) : (
                                                <Box className={cn(
                                                    "h-8 w-8",
                                                    pallet.status === 'loaded' ? "text-blue-600" : "text-orange-600"
                                                )} />
                                            )}

                                            {pallet.content && (
                                                <div className="absolute bottom-1 px-2 text-[10px] font-bold bg-white/80 dark:bg-black/80 rounded max-w-[90%] truncate">
                                                    {pallet.content}
                                                </div>
                                            )}
                                        </motion.div>
                                    </PopoverTrigger>
                                    {mode === 'edit' && (
                                        <PopoverContent className="w-60 p-3 no-drag">
                                            <div className="space-y-3">
                                                <h4 className="font-medium text-sm">Pallet {pallet.index + 1} Bewerken</h4>

                                                <div className="space-y-2">
                                                    <label className="text-xs text-muted-foreground">Inhoud</label>
                                                    <Input
                                                        value={pallet.content || ''}
                                                        onChange={(e) => updatePallet(pallet.id, { content: e.target.value })}
                                                        placeholder="Bijv. Order #1234"
                                                        className="h-8 text-sm"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-3 gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant={pallet.status === 'empty' ? 'default' : 'outline'}
                                                        className={cn(pallet.status === 'empty' && "bg-green-600 hover:bg-green-700")}
                                                        onClick={() => updatePallet(pallet.id, { status: 'empty' })}
                                                    >
                                                        Leeg
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant={pallet.status === 'loaded' ? 'default' : 'outline'}
                                                        className={cn(pallet.status === 'loaded' && "bg-blue-600 hover:bg-blue-700")}
                                                        onClick={() => updatePallet(pallet.id, { status: 'loaded' })}
                                                    >
                                                        Vol
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant={pallet.status === 'reserved' ? 'default' : 'outline'}
                                                        className={cn(pallet.status === 'reserved' && "bg-orange-600 hover:bg-orange-700")}
                                                        onClick={() => updatePallet(pallet.id, { status: 'reserved' })}
                                                    >
                                                        Rsrv
                                                    </Button>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    )}
                                </Popover>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </CardContent>
        </Card>
    );
}
