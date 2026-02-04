import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Cylinder, Map as MapIcon, Save, RotateCcw, Plus, Info, Pencil, Trash2, RotateCw, ZoomIn, ZoomOut, Move, Maximize2, Minimize2, Type } from "lucide-react";
import { cn } from "@/lib/utils";

interface StorageZone {
    id: string;
    x: number;
    y: number;
    type: string;
    label: string;
    rotation: number;
    scale: number;
    variant?: 'default' | 'text'; // 'default' for cylinder group, 'text' for just label
}

interface SiteMapProps {
    location?: "sol_emmen" | "sol_tilburg" | "all";
}

export function SiteMap({ location }: SiteMapProps) {
    const [mode, setMode] = useState<"view" | "edit">("view");
    const [zones, setZones] = useState<StorageZone[]>([
        { id: "z1", x: 300, y: 770, type: "oxygen", label: "Zuurstof", rotation: -90, scale: 1, variant: 'default' },
        { id: "z2", x: 300, y: 740, type: "nitrogen", label: "Stikstof", rotation: -90, scale: 1, variant: 'default' },
    ]);
    const [rotatingZoneId, setRotatingZoneId] = useState<string | null>(null);
    const [scalingZoneId, setScalingZoneId] = useState<string | null>(null);
    const [isRotatingMap, setIsRotatingMap] = useState(false);
    const [mapRotation, setMapRotation] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);

    // Global event handler for Rotation, Scaling AND Panning
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            // Common calculations if we are modifying a zone
            if ((rotatingZoneId || scalingZoneId) && mapRef.current) {
                const activeId = rotatingZoneId || scalingZoneId;
                const containerRect = mapRef.current.getBoundingClientRect();
                const zone = zones.find(z => z.id === activeId);

                if (zone) {
                    const zoneCenterX = containerRect.left + (zone.x + 20) * zoom; // Center calculation might vary for text vs icon but approx is fine for handles
                    const zoneCenterY = containerRect.top + (zone.y + 20) * zoom;
                    const deltaX = e.clientX - zoneCenterX;
                    const deltaY = e.clientY - zoneCenterY;

                    // Handle Rotation
                    if (rotatingZoneId) {
                        let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
                        setZones(prev => prev.map(z => z.id === activeId ? { ...z, rotation: angle } : z));
                    }

                    // Handle Scaling
                    if (scalingZoneId) {
                        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                        const baseRadius = 30; // pixels
                        const newScale = Math.max(0.5, Math.min(5, distance / (baseRadius * zoom))); // Allow slightly larger max scale for text

                        setZones(prev => prev.map(z => z.id === activeId ? { ...z, scale: newScale } : z));
                    }
                }
            }

            // Handle Map Rotation (Shift + Drag)
            if (isRotatingMap) {
                const deltaX = e.clientX - lastMousePos.current.x;
                lastMousePos.current = { x: e.clientX, y: e.clientY };

                // Sensitivity: 1px = 0.5 deg
                setMapRotation(prev => prev + deltaX * 0.5);
            }

            // Handle Panning (No Shift)
            if (isPanning && !isRotatingMap) {
                const deltaX = e.clientX - lastMousePos.current.x;
                const deltaY = e.clientY - lastMousePos.current.y;
                lastMousePos.current = { x: e.clientX, y: e.clientY };

                setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
            }
        };

        const handleGlobalMouseUp = () => {
            setRotatingZoneId(null);
            setScalingZoneId(null);
            setIsPanning(false);
            setIsRotatingMap(false);
        };

        // Keydown for Esc to exit fullscreen
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        };

        if (rotatingZoneId || scalingZoneId || isPanning || isRotatingMap) {
            window.addEventListener("mousemove", handleGlobalMouseMove);
            window.addEventListener("mouseup", handleGlobalMouseUp);
        }
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove);
            window.removeEventListener("mouseup", handleGlobalMouseUp);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [rotatingZoneId, scalingZoneId, isPanning, isRotatingMap, zones, zoom, isFullscreen]);

    // Wheel Zoom Handler
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey || mode === "edit" || true) {
            // e.preventDefault(); 
            const delta = -e.deltaY;
            setZoom(prev => {
                const newZoom = prev + delta * 0.001;
                return Math.min(Math.max(newZoom, 0.5), 3);
            });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.defaultPrevented) return;
        if ((e.target as HTMLElement).closest('button, input, .cursor-move')) return;

        lastMousePos.current = { x: e.clientX, y: e.clientY };

        if (e.shiftKey) {
            setIsRotatingMap(true);
        } else {
            setIsPanning(true);
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, input, .cursor-move')) return;
        setIsFullscreen(!isFullscreen);
    };


    // Mock data for tank levels
    const tanks = [
        { id: "t1", type: "LIN", level: 85, capacity: "20.000L", x: 220, y: 900 },
        { id: "t2", type: "LOX", level: 62, capacity: "15.000L", x: 260, y: 900 },
        { id: "t3", type: "LAR", level: 45, capacity: "10.000L", x: 300, y: 900 },
        { id: "t4", type: "LCO2", level: 91, capacity: "25.000L", x: 340, y: 900 },
        { id: "t5", type: "LCO2", level: 78, capacity: "25.000L", x: 380, y: 900 },
    ];

    const handleDragEnd = (id: string, info: any) => {
        console.log("Moved zone", id);
    };

    const addZone = () => {
        const newZone: StorageZone = {
            id: `z${Date.now()}`,
            x: 400,
            y: 450,
            type: "new",
            label: "Nieuwe Opslag",
            rotation: 0,
            scale: 1,
            variant: 'default'
        };
        setZones([...zones, newZone]);
    };

    const addTextZone = () => {
        const newZone: StorageZone = {
            id: `txt${Date.now()}`,
            x: 400,
            y: 450,
            type: "text",
            label: "Tekst Label",
            rotation: 0,
            scale: 1, // Start slightly bigger maybe? No default 1 is fine.
            variant: 'text'
        };
        setZones([...zones, newZone]);
    };

    const deleteZone = (id: string) => {
        setZones(zones.filter(z => z.id !== id));
    };

    const renameZone = (id: string, newName: string) => {
        setZones(zones.map(z => z.id === id ? { ...z, label: newName } : z));
    };

    return (
        <Card className={cn(
            "glass-card w-full overflow-hidden transition-all duration-300",
            isFullscreen ? "fixed inset-0 z-50 rounded-none h-screen w-screen bg-background/95 backdrop-blur-md" : ""
        )}>
            <CardHeader className="flex flex-row items-center justify-between z-10 relative bg-background/80 backdrop-blur-sm shadow-sm">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <MapIcon className="h-5 w-5 text-cyan-500" />
                        Site Map & Opslag Layout
                    </CardTitle>
                    <CardDescription>
                        {mode === "view"
                            ? "Overzicht van tankniveaus en opslaglocaties"
                            : "Sleep, draai en schaal elementen. Dubbelklik voor Fullscreen."}
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-1 mr-4 bg-muted/20 p-1 rounded-md">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMapRotation(r => r - 90)} title="Draai Links">
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMapRotation(r => r + 90)} title="Draai Rechts">
                            <RotateCw className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-4 bg-border mx-1"></div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}>
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <div className="w-12 text-center text-xs font-mono">{Math.round(zoom * 100)}%</div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(z + 0.2, 3))}>
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-4 bg-border mx-1"></div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); setMapRotation(0); }} title="Reset View">
                            <Move className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                        </Button>
                    </div>

                    {mode === "edit" ? (
                        <>
                            <Button variant="outline" size="sm" onClick={addTextZone} title="Tekst Toevoegen">
                                <Type className="h-4 w-4 mr-2" />
                                Tekst
                            </Button>
                            <Button variant="outline" size="sm" onClick={addZone} title="Cilinders Toevoegen">
                                <Plus className="h-4 w-4 mr-2" />
                                Opslag
                            </Button>
                            <Button size="sm" onClick={() => setMode("view")}>
                                <Save className="h-4 w-4 mr-2" />
                                Opslaan
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                            Layout Wijzigen
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent
                className={cn(
                    "p-0 relative bg-muted/10 min-h-[900px] overflow-hidden select-none",
                    isPanning || isRotatingMap ? "cursor-grabbing" : "cursor-grab",
                    isFullscreen ? "h-[calc(100vh-80px)]" : ""
                )}
                ref={containerRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
            >
                <motion.div
                    ref={mapRef}
                    className="w-full h-full origin-center"
                    animate={{ scale: zoom, x: pan.x, y: pan.y, rotate: mapRotation }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    style={{ width: '100%', height: '100%', minHeight: '900px' }}
                >
                    {/* SVG Map Layer */}
                    <svg viewBox="0 0 1024 1024" className="w-full h-full absolute inset-0 pointer-events-none">
                        {/* Background Image - Rotated 90deg CW */}
                        <image
                            href="/site-map-background.png"
                            x="0"
                            y="0"
                            width="1024"
                            height="1024"
                            preserveAspectRatio="xMidYMid slice"
                            opacity="0.9"
                            transform="rotate(90, 512, 512)"
                        />
                        <defs>
                            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeOpacity="0.03" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>

                    {/* Interactive Elements Layer */}
                    <div className="absolute inset-0">
                        <TooltipProvider>
                            {/* Tanks */}
                            {tanks.map((tank) => (
                                <Tooltip key={tank.id}>
                                    <TooltipTrigger asChild>
                                        <motion.div
                                            className={cn(
                                                "absolute w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer shadow-sm transition-colors",
                                                tank.level < 20 ? "bg-red-100 border-red-500 text-red-700" :
                                                    tank.level < 40 ? "bg-yellow-100 border-yellow-500 text-yellow-700" :
                                                        "bg-white border-cyan-500 text-cyan-700 dark:bg-slate-900"
                                            )}
                                            style={{ left: tank.x, top: tank.y }}
                                            whileHover={{ scale: 1.1 }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="text-[8px] font-bold text-center leading-tight">
                                                {tank.type}
                                            </div>
                                        </motion.div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="font-semibold">{tank.type} Tank</div>
                                        <div>Inhoud: {tank.capacity}</div>
                                        <div>Niveau: {tank.level}%</div>
                                    </TooltipContent>
                                </Tooltip>
                            ))}

                            {/* Draggable Storage Zones & Text */}
                            {zones.map((zone) => (
                                <motion.div
                                    key={zone.id}
                                    drag={mode === "edit" && !rotatingZoneId && !scalingZoneId} // Disable drag while transforming
                                    dragMomentum={false}
                                    dragConstraints={mapRef}
                                    onDragEnd={(e, info) => handleDragEnd(zone.id, info)}
                                    className={cn(
                                        "absolute flex flex-col items-center group",
                                        mode === "edit" ? "cursor-move" : "cursor-pointer"
                                    )}
                                    style={{
                                        left: zone.x,
                                        top: zone.y,
                                        rotate: zone.rotation
                                    }}
                                    animate={{ scale: zone.scale || 1 }}
                                    whileHover={{ scale: (zone.scale || 1) * 1.05 }}
                                    whileTap={{ scale: (zone.scale || 1) * 0.95 }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                    }}
                                    onDoubleClick={(e) => e.stopPropagation()}
                                >
                                    <div className={cn(
                                        "relative transition-all",
                                        mode === "edit" ? "ring-2 ring-transparent group-hover:ring-orange-200 rounded-lg p-1" : ""
                                    )}>

                                        {/* Render content based on variant */}
                                        {zone.variant === 'text' ? (
                                            <div className={cn(
                                                "text-sm font-bold px-2 py-1 rounded backdrop-blur-sm border shadow-sm whitespace-nowrap",
                                                "bg-white/80 dark:bg-black/50 border-cyan-500/30 text-cyan-900 dark:text-cyan-100",
                                                mode === "edit" && "border-orange-500/50 bg-orange-50/50"
                                            )}>
                                                {zone.label}
                                            </div>
                                        ) : (
                                            // Default Cylinder Group Variant
                                            <div className="flex flex-col items-center">
                                                <div className={cn(
                                                    "p-1.5 rounded-lg shadow-md border backdrop-blur-sm transition-all",
                                                    mode === "edit" ? "bg-orange-500/20 border-orange-500 animate-pulse" : "bg-white/70 dark:bg-black/40 border-border"
                                                )}>
                                                    <Cylinder className={cn(
                                                        "h-4 w-4",
                                                        mode === "edit" ? "text-orange-600 dark:text-orange-400" : "text-primary"
                                                    )} />
                                                </div>
                                                <Badge variant="outline" className="mt-0.5 text-[10px] px-1.5 py-0 bg-background/80 backdrop-blur-xs whitespace-nowrap shadow-sm">
                                                    {zone.label}
                                                </Badge>
                                            </div>
                                        )}


                                        {mode === "edit" && (
                                            <>
                                                {/* Handles Container - Position depends on variant/size? 
                                    Actually if we wrap everything in the parent div relative, absolute handles work fine. 
                                */}

                                                {/* Free Rotation Handle (Top) */}
                                                <div
                                                    className="absolute -top-6 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-orange-500 cursor-grab active:cursor-grabbing shadow-sm border border-white z-50 flex items-center justify-center hover:scale-110 transition-transform"
                                                    title="Draaien"
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setRotatingZoneId(zone.id);
                                                    }}
                                                >
                                                    <RotateCw className="h-2 w-2 text-white" />
                                                </div>
                                                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-orange-500"></div>

                                                {/* Free Scale Handle (Bottom Right) */}
                                                <div
                                                    className="absolute -bottom-3 -right-3 w-4 h-4 rounded-full bg-blue-500 cursor-nwse-resize active:cursor-grabbing shadow-sm border border-white z-50 flex items-center justify-center hover:scale-110 transition-transform"
                                                    title="Schalen"
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setScalingZoneId(zone.id);
                                                    }}
                                                >
                                                    <Maximize2 className="h-2 w-2 text-white" />
                                                </div>


                                                {/* Edit Menu - Counter-rotated & Scaled Inverse */}
                                                <div
                                                    className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-1 opacity-100 transition-opacity z-40 bg-background/90 rounded-full p-1 shadow-lg border"
                                                    style={{
                                                        transform: `rotate(-${zone.rotation}deg) scale(${1 / (zone.scale || 1)})`,
                                                        transformOrigin: 'bottom center'
                                                    }}
                                                >
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button size="icon" variant="ghost" className="h-4 w-4 rounded-full hover:bg-muted" title={zone.variant === 'text' ? "Tekst wijzigen" : "Naam wijzigen"} onMouseDown={(e) => e.stopPropagation()}>
                                                                <Pencil className="h-2.5 w-2.5" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-60 p-3" side="top">
                                                            <div className="space-y-2">
                                                                <h4 className="font-medium text-xs leading-none">{zone.variant === 'text' ? "Tekst aanpassen" : "Naam wijzigen"}</h4>
                                                                <div className="flex gap-2">
                                                                    <Input
                                                                        defaultValue={zone.label}
                                                                        className="h-8 text-xs"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                renameZone(zone.id, e.currentTarget.value);
                                                                            }
                                                                        }}
                                                                        onBlur={(e) => renameZone(zone.id, e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>

                                                    <div className="w-px h-3 bg-border my-auto"></div>

                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-4 w-4 rounded-full hover:bg-red-100 text-red-600"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteZone(zone.id);
                                                        }}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        title="Verwijderen"
                                                    >
                                                        <Trash2 className="h-2.5 w-2.5" />
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </TooltipProvider>

                        {/* Drag Instruction Overlay */}
                        {mode === "edit" && !isFullscreen && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-orange-500/90 text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-4 flex items-center gap-2 z-50 pointer-events-none">
                                <Info className="h-4 w-4" />
                                Sleep, Draai (rood) en Schaal (blauw) iconen
                            </div>
                        )}
                    </div>
                </motion.div>
            </CardContent>
        </Card>
    );
}
