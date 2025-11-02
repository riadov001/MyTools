import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import type { Quote, Invoice, InvoiceItem, QuoteItem } from '@shared/schema';
import logoImage from '@assets/logo-myjantes-n2iUZrkN_1759796960103.png';

interface PDFData {
  type: 'quote' | 'invoice';
  number: string;
  date: string;
  dueDate?: string;
  operationType: string;
  items: Array<{
    description: string;
    date: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    vat: number;
    amount: number;
  }>;
  clientInfo: {
    name: string;
    email: string;
    address?: string;
  };
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  notes?: string;
}

const COMPANY_INFO = {
  name: 'MY JANTES',
  tagline: 'SPÉCIALISTE JANTES ET PNEUS',
  address: '46 rue de la convention',
  city: '62800 Lievin',
  phone: '0321408053',
  email: 'contact@myjantes.com',
  website: 'www.myjantes.fr',
  bankName: 'MY JANTES - SASU',
  iban: 'FR76 3000 3029 5800 0201 0936 525',
  swift: 'BNPAFRPPXXX',
  tva: 'FR73913678199',
};

// Helper function to load logo as base64
async function getLogoBase64(): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = logoImage;
  });
}

export async function generateQuotePDF(quote: Quote, clientInfo: any, serviceInfo: any, quoteItems?: QuoteItem[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Add logo
  try {
    const logoBase64 = await getLogoBase64();
    doc.addImage(logoBase64, 'PNG', pageWidth - 60, 10, 40, 20);
  } catch (error) {
    console.error('Failed to load logo:', error);
  }
  
  // Header with logo space
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('MY JANTES', 20, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('SPÉCIALISTE JANTES ET PNEUS', 20, 32);
  
  // Document title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const quoteNumber = `DV-${new Date().getFullYear()}-${quote.id.slice(0, 6)}`;
  doc.text(`DEVIS - ${quoteNumber}`, 20, 50);
  
  // Dates and operation type
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const billingDate = new Date(quote.createdAt || Date.now()).toLocaleDateString('fr-FR');
  const dueDate = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('fr-FR') : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');
  
  doc.text(`Date de facturation: ${billingDate}`, 20, 60);
  doc.text(`Échéance: ${dueDate}`, 20, 66);
  doc.text('Type d\'opération: Opération interne', 20, 72);
  
  // Company info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, 20, 90);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.address, 20, 96);
  doc.text(COMPANY_INFO.city, 20, 102);
  doc.text(COMPANY_INFO.phone, 20, 108);
  doc.text(COMPANY_INFO.email, 20, 114);
  doc.text(COMPANY_INFO.website, 20, 120);
  
  // Client info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const clientName = clientInfo?.name || clientInfo?.email?.split('@')[0] || 'Client';
  doc.text(clientName.toUpperCase(), 20, 138);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (clientInfo?.email) {
    doc.text(clientInfo.email, 20, 144);
  }
  if (clientInfo?.address) {
    doc.text(clientInfo.address, 20, 150);
  }
  
  // Table - Use quote items if available, otherwise fall back to legacy single item
  let tableData: any[];
  
  if (quoteItems && quoteItems.length > 0) {
    // Use quote items from database
    tableData = quoteItems.map(item => ({
      description: item.description || '',
      date: billingDate,
      quantity: item.quantity?.toString() || '1',
      unit: 'pce',
      unitPrice: parseFloat(item.unitPriceExcludingTax || '0').toFixed(2),
      vat: `${parseFloat(item.taxRate || '20').toFixed(0)} %`,
      amount: parseFloat(item.totalExcludingTax || '0').toFixed(2),
    }));
  } else {
    // Legacy: Single item from quote data
    let description = serviceInfo?.description || serviceInfo?.name || 'Service automobile';
    
    // Add wheel details to description if available
    if (quote.wheelCount || quote.diameter) {
      const wheelInfo = [];
      if (quote.wheelCount) wheelInfo.push(`${quote.wheelCount} jante${quote.wheelCount > 1 ? 's' : ''}`);
      if (quote.diameter) wheelInfo.push(`Diamètre: ${quote.diameter}`);
      description = `${description} (${wheelInfo.join(', ')})`;
    }
    
    // Add product details if available
    if (quote.productDetails) {
      description = `${description}\n${quote.productDetails}`;
    }
    
    const priceHT = parseFloat(quote.priceExcludingTax || quote.quoteAmount || '0');
    const vatRate = parseFloat(quote.taxRate || '20');
    const vatAmount = parseFloat(quote.taxAmount || (priceHT * vatRate / 100).toFixed(2));
    
    tableData = [{
      description: description,
      date: billingDate,
      quantity: quote.wheelCount ? quote.wheelCount.toString() : '1.00',
      unit: 'pce',
      unitPrice: priceHT.toFixed(2),
      vat: `${vatRate.toFixed(0)} %`,
      amount: priceHT.toFixed(2),
    }];
  }
  
  autoTable(doc, {
    startY: 165,
    head: [['Description', 'Date', 'Qte', 'Unité', 'Prix unitaire', 'TVA', 'Montant']],
    body: tableData.map(item => [
      item.description,
      item.date,
      item.quantity,
      item.unit,
      `${item.unitPrice} €`,
      item.vat,
      `${item.amount} €`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 70 }
    },
  });
  
  // Totals - Calculate from quote items if available
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  let totalHT: number;
  let totalVAT: number;
  let totalTTC: number;
  let vatRate: number;
  
  if (quoteItems && quoteItems.length > 0) {
    // Calculate totals from items
    totalHT = quoteItems.reduce((sum, item) => sum + parseFloat(item.totalExcludingTax || '0'), 0);
    totalVAT = quoteItems.reduce((sum, item) => sum + parseFloat(item.taxAmount || '0'), 0);
    totalTTC = quoteItems.reduce((sum, item) => sum + parseFloat(item.totalIncludingTax || '0'), 0);
    // Get average VAT rate for display (or first item's rate)
    vatRate = quoteItems.length > 0 ? parseFloat(quoteItems[0].taxRate || '20') : 20;
  } else {
    // Legacy: Use old calculation
    const priceHT = parseFloat(quote.priceExcludingTax || quote.quoteAmount || '0');
    vatRate = parseFloat(quote.taxRate || '20');
    const vatAmount = parseFloat(quote.taxAmount || (priceHT * vatRate / 100).toFixed(2));
    
    totalHT = priceHT;
    totalVAT = vatAmount;
    totalTTC = totalHT + totalVAT;
  }
  
  doc.setFontSize(10);
  doc.text(`Total HT`, 120, finalY);
  doc.text(`${totalHT.toFixed(2)} €`, 170, finalY, { align: 'right' });
  
  doc.text(`TVA ${vatRate.toFixed(2)} %`, 120, finalY + 6);
  doc.text(`${totalVAT.toFixed(2)} €`, 170, finalY + 6, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Total TTC`, 120, finalY + 12);
  doc.text(`${totalTTC.toFixed(2)} €`, 170, finalY + 12, { align: 'right' });
  
  // Payment methods
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Moyens de paiement:', 20, finalY + 30);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY_INFO.bankName}`, 20, finalY + 38);
  doc.text(`Banque: SOCIETE GENERALE de la convention - 62800 Lievin`, 20, finalY + 44);
  doc.text(`SWIFT/BIC: ${COMPANY_INFO.swift} - Numéro de TVA: ${COMPANY_INFO.tva}`, 20, finalY + 50);
  doc.text(`IBAN: ${COMPANY_INFO.iban}`, 20, finalY + 56);
  
  // Save PDF
  doc.save(`devis-${quoteNumber}.pdf`);
}

export async function generateInvoicePDF(invoice: Invoice, clientInfo: any, quoteInfo: any, serviceInfo: any, invoiceItems?: InvoiceItem[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Add logo
  try {
    const logoBase64 = await getLogoBase64();
    doc.addImage(logoBase64, 'PNG', pageWidth - 60, 10, 40, 20);
  } catch (error) {
    console.error('Failed to load logo:', error);
  }
  
  // Header with logo space
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('MY JANTES', 20, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('SPÉCIALISTE JANTES ET PNEUS', 20, 32);
  
  // Document title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`FACTURE - ${invoice.invoiceNumber}`, 20, 50);
  
  // Dates and operation type
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const billingDate = new Date(invoice.createdAt || Date.now()).toLocaleDateString('fr-FR');
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-FR') : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');
  
  doc.text(`Date de facturation: ${billingDate}`, 20, 60);
  doc.text(`Échéance: ${dueDate}`, 20, 66);
  doc.text('Type d\'opération: Opération interne', 20, 72);
  
  // Company info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, 20, 90);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.address, 20, 96);
  doc.text(COMPANY_INFO.city, 20, 102);
  doc.text(COMPANY_INFO.phone, 20, 108);
  doc.text(COMPANY_INFO.email, 20, 114);
  doc.text(COMPANY_INFO.website, 20, 120);
  
  // Client info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const clientName = clientInfo?.name || clientInfo?.email?.split('@')[0] || 'Client';
  doc.text(clientName.toUpperCase(), 20, 138);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (clientInfo?.email) {
    doc.text(clientInfo.email, 20, 144);
  }
  if (clientInfo?.address) {
    doc.text(clientInfo.address, 20, 150);
  }
  
  // Table - Use invoice items if available, otherwise fall back to legacy single item
  let tableData: any[];
  
  if (invoiceItems && invoiceItems.length > 0) {
    // Use invoice items from database
    tableData = invoiceItems.map(item => {
      let description = item.description || '';
      
      // Add wheel count info to description if available
      if (invoice.wheelCount && invoice.wheelCount > 1) {
        description = `${description} (× ${invoice.wheelCount} jantes)`;
      }
      
      return {
        description: description,
        date: billingDate,
        quantity: item.quantity?.toString() || '1',
        unit: 'pce',
        unitPrice: parseFloat(item.unitPriceExcludingTax || '0').toFixed(2),
        vat: `${parseFloat(item.taxRate || '0').toFixed(0)} %`,
        amount: parseFloat(item.totalExcludingTax || '0').toFixed(2),
      };
    });
  } else {
    // Legacy: Create single item from invoice data
    let description = serviceInfo?.description || serviceInfo?.name || 'Service automobile';
    
    // Add wheel details to description if available
    if (invoice.wheelCount || invoice.diameter) {
      const wheelInfo = [];
      if (invoice.wheelCount) wheelInfo.push(`${invoice.wheelCount} jante${invoice.wheelCount > 1 ? 's' : ''}`);
      if (invoice.diameter) wheelInfo.push(`Diamètre: ${invoice.diameter}`);
      description = `${description} (${wheelInfo.join(', ')})`;
    }
    
    // Add product details if available
    if (invoice.productDetails) {
      description = `${description}\n${invoice.productDetails}`;
    }
    
    const priceHT = parseFloat(invoice.priceExcludingTax || invoice.amount || '0');
    const vatRate = parseFloat(invoice.taxRate || '20');
    
    tableData = [{
      description: description,
      date: billingDate,
      quantity: invoice.wheelCount ? invoice.wheelCount.toString() : '1.00',
      unit: 'pce',
      unitPrice: priceHT.toFixed(2),
      vat: `${vatRate.toFixed(0)} %`,
      amount: priceHT.toFixed(2),
    }];
  }
  
  autoTable(doc, {
    startY: 165,
    head: [['Description', 'Date', 'Qte', 'Unité', 'Prix unitaire', 'TVA', 'Montant']],
    body: tableData.map(item => [
      item.description,
      item.date,
      item.quantity,
      item.unit,
      `${item.unitPrice} €`,
      item.vat,
      `${item.amount} €`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 70 }
    },
  });
  
  // Totals - Calculate from invoice items if available
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  let totalHT: number;
  let totalVAT: number;
  let totalTTC: number;
  let vatRate: number;
  
  if (invoiceItems && invoiceItems.length > 0) {
    // Calculate totals from items
    totalHT = invoiceItems.reduce((sum, item) => sum + parseFloat(item.totalExcludingTax || '0'), 0);
    totalVAT = invoiceItems.reduce((sum, item) => sum + parseFloat(item.taxAmount || '0'), 0);
    totalTTC = invoiceItems.reduce((sum, item) => sum + parseFloat(item.totalIncludingTax || '0'), 0);
    // Get average VAT rate for display (or first item's rate)
    vatRate = invoiceItems.length > 0 ? parseFloat(invoiceItems[0].taxRate || '20') : 20;
  } else {
    // Legacy: Use old calculation
    const priceHT = parseFloat(invoice.priceExcludingTax || invoice.amount || '0');
    vatRate = parseFloat(invoice.taxRate || '20');
    const vatAmount = parseFloat(invoice.taxAmount || (priceHT * vatRate / 100).toFixed(2));
    totalHT = priceHT;
    totalVAT = vatAmount;
    totalTTC = totalHT + totalVAT;
  }
  
  doc.setFontSize(10);
  doc.text(`Total HT`, 120, finalY);
  doc.text(`${totalHT.toFixed(2)} €`, 170, finalY, { align: 'right' });
  
  doc.text(`TVA ${vatRate.toFixed(2)} %`, 120, finalY + 6);
  doc.text(`${totalVAT.toFixed(2)} €`, 170, finalY + 6, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Total TTC`, 120, finalY + 12);
  doc.text(`${totalTTC.toFixed(2)} €`, 170, finalY + 12, { align: 'right' });
  
  // Payment methods
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Moyens de paiement:', 20, finalY + 30);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY_INFO.bankName}`, 20, finalY + 38);
  doc.text(`Banque: SOCIETE GENERALE de la convention - 62800 Lievin`, 20, finalY + 44);
  doc.text(`SWIFT/BIC: ${COMPANY_INFO.swift} - Numéro de TVA: ${COMPANY_INFO.tva}`, 20, finalY + 50);
  doc.text(`IBAN: ${COMPANY_INFO.iban}`, 20, finalY + 56);
  
  // Save PDF
  doc.save(`facture-${invoice.invoiceNumber}.pdf`);
}

// Generate labels PDF with QR codes for wheels and car key
export async function generateLabelsPDF(invoiceOrQuote: Invoice | Quote, type: 'invoice' | 'quote') {
  const doc = new jsPDF();
  
  // Get document number
  const docNumber = type === 'invoice' 
    ? (invoiceOrQuote as Invoice).invoiceNumber
    : `DV-${new Date().getFullYear()}-${invoiceOrQuote.id.slice(0, 6)}`;
  
  // Label positions and text
  const labels = [
    { position: 'AVG', name: 'AVANT GAUCHE' },
    { position: 'AVD', name: 'AVANT DROITE' },
    { position: 'ARG', name: 'ARRIÈRE GAUCHE' },
    { position: 'ARD', name: 'ARRIÈRE DROITE' },
    { position: 'CLÉ', name: 'CLÉ VÉHICULE' }
  ];
  
  // A4 dimensions
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  
  // Calculate label dimensions (5 labels on one page)
  const labelHeight = pageHeight / 5;
  const qrSize = 50; // QR code size
  
  // Generate QR code data URL for each label
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const yPos = i * labelHeight;
    
    // Generate QR code with document number and position
    const qrData = `${docNumber}-${label.position}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 1,
    });
    
    // Draw border around label
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(10, yPos + 10, pageWidth - 20, labelHeight - 20);
    
    // Add QR code (left side)
    doc.addImage(qrCodeDataUrl, 'PNG', 20, yPos + labelHeight / 2 - qrSize / 2, qrSize, qrSize);
    
    // Add position text (center-right)
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(label.position, pageWidth / 2, yPos + labelHeight / 2 - 10, { align: 'center' });
    
    // Add full name
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(label.name, pageWidth / 2, yPos + labelHeight / 2 + 5, { align: 'center' });
    
    // Add document number
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(docNumber, pageWidth / 2, yPos + labelHeight / 2 + 15, { align: 'center' });
  }
  
  // Save PDF
  const fileName = type === 'invoice' 
    ? `etiquettes-facture-${docNumber}.pdf`
    : `etiquettes-devis-${docNumber}.pdf`;
  doc.save(fileName);
}
