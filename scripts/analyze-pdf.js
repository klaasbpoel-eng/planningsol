
import { readFile } from 'fs/promises';

// Use dynamic import for ES module compat in this script
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

async function analyzePdf(filePath) {
    try {
        const data = await readFile(filePath);
        const uint8Array = new Uint8Array(data);

        const loadingTask = pdfjsLib.getDocument({
            data: uint8Array,
            standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
        });

        const pdf = await loadingTask.promise;
        console.log(`PDF Loaded: ${pdf.numPages} pages`);

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Raw items
            const textItems = textContent.items.map((item) => item.str);
            const joinedText = textItems.join(" ");

            console.log(`--- Page ${i} ---`);
            console.log("Text items found:", textItems.length);
            if (textItems.length > 0) {
                console.log("Snippet:", joinedText.substring(0, 50));
            }

            // Check for operators (images)
            try {
                const ops = await page.getOperatorList();
                // OPS.paintImageXObject = 35, OPS.paintInlineImageXObject = 36
                // We need to access OPS from the library or just check for common image op codes if we can't easy access OPS enum
                // pdfjsLib.OPS should be available

                let hasImage = false;
                if (pdfjsLib.OPS) {
                    hasImage = ops.fnArray.includes(pdfjsLib.OPS.paintImageXObject) || ops.fnArray.includes(pdfjsLib.OPS.paintInlineImageXObject);
                } else {
                    // Fallback check if OPS is not directly on default export (it might be on Util or similar)
                    // But usually it is on the main object.
                    // Let's just log unique op codes to see what's there
                    // console.log("Unique Op Codes:", [...new Set(ops.fnArray)]);
                    // Common Image ops are 35 and 36 usually, but can vary by version.
                    // Let's assume standard pdf.js ops.
                    hasImage = ops.fnArray.includes(82) || ops.fnArray.includes(83); // 82=paintImageXObject, 83=paintInlineImageXObject in some versions? 
                    // Actually, let's just log the op codes and look for high frequency drawing ops
                }

                // Let's rely on the module export
                if (pdfjsLib.OPS) {
                    const imgOps = [pdfjsLib.OPS.paintImageXObject, pdfjsLib.OPS.paintInlineImageXObject, pdfjsLib.OPS.paintXObject];
                    hasImage = ops.fnArray.some(op => imgOps.includes(op));
                    console.log(`Has Image Operators: ${hasImage}`);
                }

            } catch (e) {
                console.log("Error getting ops:", e.message);
            }

            // Check for Annotations
            const anns = await page.getAnnotations();
            console.log(`Annotations count: ${anns.length}`);
            if (anns.length > 0) {
                const annValues = anns.map(a => a.fieldValue || a.contents || "").filter(Boolean);
                console.log("Annotation values:", annValues);
            }
        }

    } catch (err) {
        console.error("Error analyzing PDF:", err);
    }
}

const filePath = 'C:/Users/Gebruiker/Downloads/20260219130154765.pdf';
analyzePdf(filePath);
