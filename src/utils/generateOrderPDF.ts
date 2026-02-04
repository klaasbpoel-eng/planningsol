import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

// Define interface locally or import from types if available shared
export interface OrderItem {
    articleId: string;
    articleName: string;
    quantity: number;
}

export interface InternalOrder {
    id: string;
    order_number?: string;
    date: Date;
    from: string;
    to: string;
    items: OrderItem[];
    status: "pending" | "shipped" | "received";
}

const getLocationName = (loc: string) => {
    return loc === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg";
};

export const generateOrderPDF = (order: InternalOrder) => {
    const doc = new jsPDF();

    // Use order_number if available, otherwise fall back to id
    const displayOrderNumber = order.order_number || order.id;

    // Color settings
    const primaryColor = [0, 82, 155] as [number, number, number]; // SOL Blue-ish check
    const secondaryColor = [247, 148, 29] as [number, number, number]; // SOL Orange-ish

    // Header / Logo area
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Interne Bestelling", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Ordernummer: ${displayOrderNumber}`, 14, 30);
    doc.text(`Datum: ${format(order.date, "d MMMM yyyy, HH:mm", { locale: nl })}`, 14, 35);

    // Line
    doc.setDrawColor(200);
    doc.line(14, 40, 196, 40);

    // Locations
    doc.setFontSize(12);
    doc.setTextColor(0);

    // From
    doc.setFont("helvetica", "bold");
    doc.text("Van:", 14, 50);
    doc.setFont("helvetica", "normal");
    doc.text(getLocationName(order.from), 14, 56);

    // To
    doc.setFont("helvetica", "bold");
    doc.text("Naar:", 100, 50);
    doc.setFont("helvetica", "normal");
    doc.text(getLocationName(order.to), 100, 56);

    // Table
    const tableColumn = ["Artikelnummer", "Omschrijving", "Aantal"];
    const tableRows = order.items.map(item => [
        item.articleId,
        item.articleName,
        item.quantity.toString()
    ]);

    autoTable(doc, {
        startY: 65,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: {
            fillColor: primaryColor,
            textColor: 255,
            fontStyle: 'bold'
        },
        styles: {
            fontSize: 10,
            cellPadding: 3
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 40 }, // ID column
            2: { halign: 'center', cellWidth: 30 }   // Quantity column
        },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height || 297;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Gegenereerd door PlanningSOL", 14, pageHeight - 10);

    // Save
    doc.save(`Bestelling_${displayOrderNumber}.pdf`);
};
