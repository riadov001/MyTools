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

// Helper function to load logo as base64 using fetch
async function getLogoBase64(): Promise<string> {
  try {
    const response = await fetch(logoImage);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to fetch logo:', error);
    throw error;
  }
}

export async function generateQuotePDF(quote: Quote, clientInfo: any, serviceInfo: any, quoteItems?: QuoteItem[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const quoteNumber = quote.reference || `DV-${new Date().getFullYear()}-${quote.id.slice(0, 6)}`;
  
  // Add logo first (CENTER)
  try {
    const logoBase64 = await getLogoBase64();
    doc.addImage(logoBase64, 'PNG', pageWidth / 2 - 20, 10, 40, 20);
  } catch (error) {
    console.error('Failed to add logo:', error);
  }
  
  // Document title (TOP LEFT)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`DEVIS - ${quoteNumber}`, 20, 15);
  
  // Dates and operation type (RIGHT side)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const billingDate = new Date(quote.createdAt || Date.now()).toLocaleDateString('fr-FR');
  const dueDate = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('fr-FR') : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');
  
  doc.text(`Date de facturation: ${billingDate}`, pageWidth - 20, 28, { align: 'right' });
  doc.text(`Échéance: ${dueDate}`, pageWidth - 20, 34, { align: 'right' });
  doc.text('Type d\'opération: Opération interne', pageWidth - 20, 40, { align: 'right' });
  
  // Company info (LEFT side, below logo)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, 20, 50);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.address, 20, 56);
  doc.text(COMPANY_INFO.city, 20, 61);
  doc.text(COMPANY_INFO.phone, 20, 66);
  doc.text(COMPANY_INFO.email, 20, 71);
  doc.text(COMPANY_INFO.website, 20, 76);
  
  // Client info (RIGHT side)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const clientName = clientInfo?.name || clientInfo?.email?.split('@')[0] || 'Client';
  doc.text(clientName.toUpperCase(), pageWidth - 20, 50, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (clientInfo?.email) {
    doc.text(clientInfo.email, pageWidth - 20, 56, { align: 'right' });
  }
  if (clientInfo?.address) {
    doc.text(clientInfo.address, pageWidth - 20, 61, { align: 'right' });
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
    startY: 90,
    head: [['Description', 'Date', 'Qté', 'Unité', 'Prix unitaire', 'TVA', 'Montant']],
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
  doc.text('Moyens de paiement:', 20, finalY + 20);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Banque: SOCIETE GENERALE', 20, finalY + 27);
  doc.text(`SWIFT/BIC: ${COMPANY_INFO.swift}`, 20, finalY + 33);
  doc.text(`IBAN: ${COMPANY_INFO.iban}`, 20, finalY + 39);
  doc.text('30 jours', 20, finalY + 45);
  
  // Payment conditions
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Conditions de paiement:', 20, finalY + 57);
  
  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`${COMPANY_INFO.bankName}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY_INFO.address} ${COMPANY_INFO.city}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
  doc.text(`Numéro de SIRET 913678199 00021 / Numéro de TVA ${COMPANY_INFO.tva}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  
  // Save PDF
  doc.save(`devis-${quoteNumber}.pdf`);
}

export async function generateInvoicePDF(invoice: Invoice, clientInfo: any, quoteInfo: any, serviceInfo: any, invoiceItems?: InvoiceItem[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Add logo first (CENTER)
  try {
    const logoBase64 = await getLogoBase64();
    doc.addImage(logoBase64, 'PNG', pageWidth / 2 - 20, 10, 40, 20);
  } catch (error) {
    console.error('Failed to add logo:', error);
  }
  
  // Document title (TOP LEFT) - after logo
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`FACTURE - ${invoice.invoiceNumber}`, 20, 15);
  
  // Dates and operation type (RIGHT side)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const billingDate = new Date(invoice.createdAt || Date.now()).toLocaleDateString('fr-FR');
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-FR') : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');
  
  doc.text(`Date de facturation: ${billingDate}`, pageWidth - 20, 28, { align: 'right' });
  doc.text(`Échéance: ${dueDate}`, pageWidth - 20, 34, { align: 'right' });
  doc.text('Type d\'opération: Opération interne', pageWidth - 20, 40, { align: 'right' });
  
  // Company info (LEFT side, below logo)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, 20, 50);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.address, 20, 56);
  doc.text(COMPANY_INFO.city, 20, 61);
  doc.text(COMPANY_INFO.phone, 20, 66);
  doc.text(COMPANY_INFO.email, 20, 71);
  doc.text(COMPANY_INFO.website, 20, 76);
  
  // Client info (RIGHT side)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const clientName = clientInfo?.name || clientInfo?.email?.split('@')[0] || 'Client';
  doc.text(clientName.toUpperCase(), pageWidth - 20, 50, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (clientInfo?.email) {
    doc.text(clientInfo.email, pageWidth - 20, 56, { align: 'right' });
  }
  if (clientInfo?.address) {
    doc.text(clientInfo.address, pageWidth - 20, 61, { align: 'right' });
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
    startY: 90,
    head: [['Description', 'Date', 'Qté', 'Unité', 'Prix unitaire', 'TVA', 'Montant']],
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
  doc.text('Moyens de paiement:', 20, finalY + 20);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Banque: SOCIETE GENERALE', 20, finalY + 27);
  doc.text(`SWIFT/BIC: ${COMPANY_INFO.swift}`, 20, finalY + 33);
  doc.text(`IBAN: ${COMPANY_INFO.iban}`, 20, finalY + 39);
  doc.text('30 jours', 20, finalY + 45);
  
  // Payment conditions
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Conditions de paiement:', 20, finalY + 57);
  
  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`${COMPANY_INFO.bankName}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY_INFO.address} ${COMPANY_INFO.city}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
  doc.text(`Numéro de SIRET 913678199 00021 / Numéro de TVA ${COMPANY_INFO.tva}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  
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
