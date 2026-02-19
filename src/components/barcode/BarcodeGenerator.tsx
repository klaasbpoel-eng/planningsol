import { useState, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Copy, RefreshCw, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import html2canvas from "html2canvas";

const PREFIXES = ["SOL", "GAS", "CYL", "DRY"];

export function BarcodeGenerator() {
    const [input, setInput] = useState("");
    const svgRef = useRef<SVGSVGElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    // Auto-focus on mount
    useEffect(() => {
        const inputEl = document.getElementById("barcode-input");
        if (inputEl) inputEl.focus();
    }, []);

    // Generate barcode whenever input changes
    useEffect(() => {
        if (svgRef.current && input.length > 0) {
            try {
                JsBarcode(svgRef.current, input, {
                    format: "CODE128",
                    lineColor: "#000",
                    width: 2.5,
                    height: 80,
                    displayValue: true,
                    fontSize: 20,
                    font: "monospace",
                    margin: 10,
                    background: "#ffffff",
                });
            } catch (e) {
                // Ignore invalid chars during typing
            }
        }
    }, [input]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Uppercase and alpha-numeric only (allow some basic chars)
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
        setInput(val);
    };

    const addPrefix = (prefix: string) => {
        // If input already has 3 chars (e.g. 042), prepend prefix
        // If input is empty, just set prefix
        if (input.length === 0) {
            setInput(prefix);
            document.getElementById("barcode-input")?.focus();
        } else {
            // Just replace the first 3 chars or append if short
            const suffix = input.length > 3 ? input.slice(-3) : input;
            setInput((prefix + suffix).slice(0, 6));
            document.getElementById("barcode-input")?.focus();
        }
    };

    const handleClear = () => {
        setInput("");
        document.getElementById("barcode-input")?.focus();
    };

    const generateRandom = () => {
        const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
        const num = Math.floor(Math.random() * 999).toString().padStart(3, "0");
        setInput(prefix + num);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(input);
        toast.success("Code gekopieerd!");
    };

    const downloadPng = async () => {
        if (!cardRef.current) return;
        try {
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: "#ffffff",
                scale: 2, // Check for high res
            });
            const link = document.createElement("a");
            link.download = `${input}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            toast.success("Gedownload als PNG");
        } catch (err) {
            toast.error("Fout bij downloaden");
        }
    };

    const isValid = input.length === 6;

    return (
        <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col items-center p-4">
            {/* Header */}
            <div className="w-full max-w-md flex items-center justify-between mb-6">
                <Link to="/">
                    <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                </Link>
                <h1 className="text-lg font-mono font-bold tracking-wider text-white/90">
                    BARCODE GEN
                </h1>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Main Content */}
            <div className="w-full max-w-md flex flex-col gap-6 flex-1">

                {/* Input Display */}
                <div className="relative">
                    <Input
                        id="barcode-input"
                        value={input}
                        onChange={handleInputChange}
                        className="h-20 text-center text-4xl font-mono tracking-[0.2em] bg-white/5 border-2 border-white/10 focus:border-primary/50 text-white rounded-xl placeholder:text-white/10"
                        placeholder="______"
                        autoComplete="off"
                        autoCapitalize="characters"
                    />
                    {input.length > 0 && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-white/30">
                            {input.length}/6
                        </div>
                    )}
                </div>

                {/* Prefix Buttons */}
                <div className="grid grid-cols-4 gap-2">
                    {PREFIXES.map((prefix) => (
                        <Button
                            key={prefix}
                            onClick={() => addPrefix(prefix)}
                            variant="outline"
                            className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white h-12 font-mono font-bold"
                        >
                            {prefix}
                        </Button>
                    ))}
                </div>

                {/* Barcode Preview Card */}
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                    {input.length > 0 ? (
                        <div
                            ref={cardRef}
                            className={cn(
                                "bg-white p-6 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.1)] w-full flex flex-col items-center justify-center transition-all duration-300",
                                isValid ? "opacity-100 scale-100" : "opacity-50 scale-95 grayscale"
                            )}
                        >
                            <svg ref={svgRef} className="w-full max-w-[300px] h-auto" />
                            {(!isValid && input.length > 0) && (
                                <p className="text-red-500 font-mono text-xs mt-2 animate-pulse">
                                    Vul 6 karakters in
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="text-white/20 font-mono text-sm text-center">
                            Typ om barcode te genereren...
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 mt-auto mb-6">
                    <Button
                        onClick={handleClear}
                        variant="ghost"
                        className="h-14 bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    >
                        <RefreshCw className="mr-2 h-5 w-5" />
                        Nieuw
                    </Button>

                    {isValid ? (
                        <Button
                            onClick={downloadPng}
                            className="h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_rgba(var(--primary),0.4)]"
                        >
                            <Download className="mr-2 h-5 w-5" />
                            PNG
                        </Button>
                    ) : (
                        <Button
                            onClick={generateRandom}
                            variant="outline"
                            className="h-14 bg-transparent border-white/20 text-white/50 hover:bg-white/5 hover:text-white"
                        >
                            Random
                        </Button>
                    )}
                </div>

                <div className="text-center text-white/30 text-xs font-mono mb-4">
                    Houd scherm voor scanner • Code 128
                </div>
            </div>
        </div>
    );
}
