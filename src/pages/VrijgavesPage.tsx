
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

const VrijgavesPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedPdfBytes, setProcessedPdfBytes] = useState<Uint8Array | null>(null);
    const [stats, setStats] = useState<{ totalPages: number; selectedPages: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setProcessedPdfBytes(null);
            setStats(null);
            setError(null);
        }
    };

    const processPdf = async () => {
        if (!file) return;

        setIsProcessing(true);
        setError(null);
        setProcessedPdfBytes(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            const totalPages = pdf.numPages;
            const pagesToKeep: number[] = [];

            // Iterate through all pages to find the text
            for (let i = 1; i <= totalPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const textItems = textContent.items.map((item: any) => item.str).join(" ");

                // Check if the specific text exists
                // Using a flexible regex to catch "vrijgave statement QP" case-insensitive
                if (/vrijgave\s+statement\s+qp/i.test(textItems)) {
                    pagesToKeep.push(i - 1); // pdf-lib uses 0-based index
                }
            }

            if (pagesToKeep.length === 0) {
                setError("Geen pagina's gevonden met de tekst 'vrijgave statement QP'.");
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
            toast.success(`${pagesToKeep.length} pagina('s) succesvol geselecteerd!`);

        } catch (err: any) {
            console.error("Error processing PDF:", err);
            // Show the actual error message
            setError(`Fout details: ${err.message || err}`);
            toast.error("Fout bij verwerken PDF");
        } finally {
            setIsProcessing(false);
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
                    <CardTitle>PDF Uploaden</CardTitle>
                    <CardDescription>
                        Upload een PDF bestand om automatisch de pagina's te selecteren met het "vrijgave statement QP".
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
                                        Verwerken...
                                    </>
                                ) : (
                                    <>
                                        <FileUp className="mr-2 h-4 w-4" />
                                        Start Verwerking
                                    </>
                                )}
                            </Button>
                        )}
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Fout</AlertTitle>
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
