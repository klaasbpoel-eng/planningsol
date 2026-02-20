
import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileUp, Download, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Set worker source for pdf.js
// using CDN as a fallback, but trying to import if possible, usually direct import with vite ?url is best
// However, to be safe without changing vite config, we will use a fixed version from unpkg for now which is reliable.
// But pdfjs-dist 5.x is ES module based.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Helper to convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h * 360, s * 100, l * 100];
}

const VrijgavesPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [processedPdfBytes, setProcessedPdfBytes] = useState<Uint8Array | null>(null);
    const [stats, setStats] = useState<{ totalPages: number; selectedPages: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setProcessedPdfBytes(null);
            setStats(null);
            setError(null);
            setProgress(null);
        }
    };

    const processPdf = async () => {
        if (!file) return;

        setIsProcessing(true);
        setError(null);
        setProcessedPdfBytes(null);
        setProgress(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            const totalPages = pdf.numPages;
            const pagesToKeep: number[] = [];

            setProgress({ current: 0, total: totalPages });

            // Iterate through all pages
            // We need to render them to canvas to check pixels
            for (let i = 1; i <= totalPages; i++) {
                setProgress({ current: i, total: totalPages });

                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 0.5 }); // Scale down for speed, sufficient for color blob detection

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                if (!context) continue;

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                // Define center region: middle 50% width, middle 30% height
                const startX = Math.floor(viewport.width * 0.25);
                const startY = Math.floor(viewport.height * 0.35); // slightly above middle to capture headers/labels
                const scanWidth = Math.floor(viewport.width * 0.5);
                const scanHeight = Math.floor(viewport.height * 0.3);

                const imageData = context.getImageData(startX, startY, scanWidth, scanHeight);
                const data = imageData.data;
                let orangePixelCount = 0;

                // Pixel analysis
                for (let j = 0; j < data.length; j += 4) {
                    const r = data[j];
                    const g = data[j + 1];
                    const b = data[j + 2];
                    // Alpha data[j+3] ignored

                    const [h, s, l] = rgbToHsl(r, g, b);

                    // Orange Definition:
                    // Hue: 20-55 (Orange/Yellow-Orange range)
                    // Saturation: > 40% (Vibrant enough)
                    // Lightness: > 20% && < 90% (Not too dark, not too white)
                    if (h >= 15 && h <= 55 && s > 40 && l > 20 && l < 90) {
                        orangePixelCount++;
                    }
                }

                // Threshold: If > 0.5% of the scanned area is orange
                // This is arbitrary but reasonable for a "label"
                const totalScannedPixels = scanWidth * scanHeight;
                const threshold = totalScannedPixels * 0.005;

                if (orangePixelCount > threshold) {
                    pagesToKeep.push(i - 1);
                }

                // Cleanup to free memory
                canvas.width = 0;
                canvas.height = 0;
            }

            if (pagesToKeep.length === 0) {
                setError("Geen pagina's gevonden met een oranje label/markering.");
                setStats({ totalPages, selectedPages: 0 });
                setIsProcessing(false);
                return;
            }

            // Create new PDF with selected pages
            const srcDoc = await PDFDocument.load(arrayBuffer);
            const newDoc = await PDFDocument.create();

            const copiedPages = await newDoc.copyPages(srcDoc, pagesToKeep);

            copiedPages.forEach((page) => {
                newDoc.addPage(page);
            });

            const pdfBytes = await newDoc.save();
            setProcessedPdfBytes(pdfBytes);
            setStats({ totalPages, selectedPages: pagesToKeep.length });
            toast.success(`${pagesToKeep.length} pagina('s) gevonden met oranje label!`);

        } catch (err: any) {
            console.error("Error processing PDF:", err);
            // Show the actual error message
            setError(`Fout details: ${err.message || err}`);
            toast.error("Fout bij verwerken PDF");
        } finally {
            setIsProcessing(false);
            setProgress(null);
        }
    };

    const downloadPdf = () => {
        if (!processedPdfBytes) return;

        const blob = new Blob([processedPdfBytes as any], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `vrijgave-export-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="container mx-auto py-8 max-w-2xl px-4">
            <h1 className="text-3xl font-bold mb-8 text-primary">Vrijgaves Genereren</h1>

            <Card>
                <CardHeader>
                    <CardTitle>PDF Uploaden (Visuele Scan)</CardTitle>
                    <CardDescription>
                        Upload een PDF bestand. Het systeem zoekt automatisch naar pagina's met een <strong>oranje label</strong> in het midden.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col gap-4">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Input
                                type="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                className="cursor-pointer"
                            />
                        </div>

                        {file && (
                            <Button
                                onClick={processPdf}
                                disabled={isProcessing}
                                className="w-full sm:w-auto"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {progress ? `Scannen... ${progress.current}/${progress.total}` : 'Verwerken...'}
                                    </>
                                ) : (
                                    <>
                                        <FileUp className="mr-2 h-4 w-4" />
                                        Start Visuele Scan
                                    </>
                                )}
                            </Button>
                        )}

                        {isProcessing && progress && (
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-primary h-full transition-all duration-300"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                        )}
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Resultaat</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {stats && !error && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
                            <div className="flex items-center gap-2 text-green-600 font-medium">
                                <CheckCircle className="h-5 w-5" />
                                Verwerking voltooid
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Totaal aantal pagina's: <span className="font-medium text-foreground">{stats.totalPages}</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Geselecteerde pagina's: <span className="font-medium text-foreground">{stats.selectedPages}</span>
                            </p>
                        </div>
                    )}

                    {processedPdfBytes && (
                        <Button
                            onClick={downloadPdf}
                            className="w-full bg-green-600 hover:bg-green-700"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download Nieuwe PDF
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default VrijgavesPage;
