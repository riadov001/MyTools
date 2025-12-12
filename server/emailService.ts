// Reference: Resend integration for sending transactional emails
import { Resend } from 'resend';

const FROM_EMAIL = 'MyJantes <contact@pointdepart.com>';

export async function getResendClient() {
  const apiKey = process.env.Resend;
  
  if (!apiKey) {
    throw new Error('Resend API key not configured. Please add the API key in the secret named "Resend".');
  }
  
  return {
    client: new Resend(apiKey),
    fromEmail: FROM_EMAIL
  };
}

interface Attachment {
  filename: string;
  content: Buffer | string;
}

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
}

export async function sendEmail(data: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const emailPayload: any = {
      from: fromEmail || 'MyJantes <noreply@resend.dev>',
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
    };
    
    if (data.attachments && data.attachments.length > 0) {
      emailPayload.attachments = data.attachments.map(att => ({
        filename: att.filename,
        content: typeof att.content === 'string' ? Buffer.from(att.content, 'base64') : att.content,
      }));
    }
    
    const result = await client.emails.send(emailPayload);

    if (result.error) {
      console.error('Resend error:', result.error);
      // If domain is not verified, suggest fallback
      if (result.error.message?.includes('not verified') || result.error.message?.includes('not found')) {
        console.warn(`Domain "${fromEmail}" not verified in Resend. To fix this, verify the domain in your Resend dashboard (https://resend.com/domains)`);
      }
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export function generateQuoteApprovedEmailHtml(data: {
  clientName: string;
  quoteNumber: string;
  quoteDate: string;
  amount: string;
  companyName: string;
  items: Array<{ description: string; quantity: number; unitPrice: string; total: string }>;
}): string {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.unitPrice}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.total}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Devis Validé ${data.quoteNumber}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">${data.companyName}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Votre spécialiste jantes</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #16a34a; margin-top: 0;">Devis Validé - N° ${data.quoteNumber}</h2>
        
        <p>Bonjour ${data.clientName},</p>
        
        <p>Bonne nouvelle ! Votre devis du ${data.quoteDate} a été validé.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Description</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qté</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Prix unit.</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div style="text-align: right; margin-top: 20px; padding: 15px; background: white; border-radius: 8px;">
          <p style="font-size: 18px; font-weight: bold; color: #16a34a; margin: 0;">Total TTC: ${data.amount}</p>
        </div>
        
        <p style="margin-top: 30px;">Nous allons maintenant préparer votre facture. Vous serez notifié dès qu'elle sera disponible.</p>
        
        <p>N'hésitez pas à nous contacter pour toute question.</p>
        
        <p>Cordialement,<br><strong>L'équipe ${data.companyName}</strong></p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
        <p>Ce message a été envoyé automatiquement depuis ${data.companyName}.</p>
      </div>
    </body>
    </html>
  `;
}

export function generateQuoteEmailHtml(data: {
  clientName: string;
  quoteNumber: string;
  quoteDate: string;
  amount: string;
  companyName: string;
  items: Array<{ description: string; quantity: number; unitPrice: string; total: string }>;
}): string {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.unitPrice}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.total}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Devis ${data.quoteNumber}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">${data.companyName}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Votre spécialiste jantes</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #dc2626; margin-top: 0;">Votre devis - N° ${data.quoteNumber}</h2>
        
        <p>Bonjour ${data.clientName},</p>
        
        <p>Veuillez trouver ci-joint votre devis du ${data.quoteDate}.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Description</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qté</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Prix unit.</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div style="text-align: right; margin-top: 20px; padding: 15px; background: white; border-radius: 8px;">
          <p style="font-size: 18px; font-weight: bold; color: #dc2626; margin: 0;">Total TTC: ${data.amount}</p>
        </div>
        
        <p style="margin-top: 30px;">N'hésitez pas à nous contacter pour toute question ou demande de modification.</p>
        
        <p>Cordialement,<br><strong>L'équipe ${data.companyName}</strong></p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
        <p>Ce message a été envoyé automatiquement depuis ${data.companyName}.</p>
      </div>
    </body>
    </html>
  `;
}

export function generateInvoiceEmailHtml(data: {
  clientName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  companyName: string;
  items: Array<{ description: string; quantity: number; unitPrice: string; total: string }>;
}): string {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.unitPrice}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.total}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Facture ${data.invoiceNumber}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">${data.companyName}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Votre spécialiste jantes</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #dc2626; margin-top: 0;">Facture - N° ${data.invoiceNumber}</h2>
        
        <p>Bonjour ${data.clientName},</p>
        
        <p>Veuillez trouver ci-joint votre facture du ${data.invoiceDate}.</p>
        <p style="color: #666; font-size: 14px;">Date d'échéance: <strong>${data.dueDate}</strong></p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Description</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qté</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Prix unit.</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div style="text-align: right; margin-top: 20px; padding: 15px; background: white; border-radius: 8px;">
          <p style="font-size: 18px; font-weight: bold; color: #dc2626; margin: 0;">Total TTC: ${data.amount}</p>
        </div>
        
        <p style="margin-top: 30px;">Merci pour votre confiance. N'hésitez pas à nous contacter pour toute question.</p>
        
        <p>Cordialement,<br><strong>L'équipe ${data.companyName}</strong></p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
        <p>Ce message a été envoyé automatiquement depuis ${data.companyName}.</p>
      </div>
    </body>
    </html>
  `;
}

export function generateInvoicePaidEmailHtml(data: {
  clientName: string;
  invoiceNumber: string;
  amount: string;
  paymentDate: string;
  companyName: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Paiement reçu - ${data.invoiceNumber}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">${data.companyName}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Votre spécialiste jantes</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #16a34a; margin-top: 0;">✓ Paiement reçu</h2>
        
        <p>Bonjour ${data.clientName},</p>
        
        <p>Nous confirmons la réception de votre paiement pour la facture <strong>${data.invoiceNumber}</strong>.</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
          <p style="margin: 0;">
            <strong>Montant payé:</strong> ${data.amount}<br>
            <strong>Date de paiement:</strong> ${data.paymentDate}
          </p>
        </div>
        
        <p>Merci beaucoup pour votre confiance et votre rapidité.</p>
        
        <p>Cordialement,<br><strong>L'équipe ${data.companyName}</strong></p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
        <p>Ce message a été envoyé automatiquement depuis ${data.companyName}.</p>
      </div>
    </body>
    </html>
  `;
}

export function generateReservationConfirmedEmailHtml(data: {
  clientName: string;
  reservationDate: string;
  reservationTime: string;
  serviceName: string;
  companyName: string;
  notes?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Réservation confirmée</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">${data.companyName}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Votre spécialiste jantes</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #16a34a; margin-top: 0;">✓ Réservation confirmée</h2>
        
        <p>Bonjour ${data.clientName},</p>
        
        <p>Votre réservation a été confirmée !</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
          <p style="margin: 0;">
            <strong>Service:</strong> ${data.serviceName}<br>
            <strong>Date:</strong> ${data.reservationDate}<br>
            <strong>Heure:</strong> ${data.reservationTime}
          </p>
          ${data.notes ? `<p style="margin-top: 10px; color: #666;"><strong>Notes:</strong> ${data.notes}</p>` : ''}
        </div>
        
        <p>À bientôt pour votre service !</p>
        
        <p>Cordialement,<br><strong>L'équipe ${data.companyName}</strong></p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
        <p>Ce message a été envoyé automatiquement depuis ${data.companyName}.</p>
      </div>
    </body>
    </html>
  `;
}

// PDF Generation
export function generateQuotePDF(data: {
  quoteNumber: string;
  quoteDate: string;
  clientName: string;
  items: Array<{ description: string; quantity: number; unitPrice: string; total: string }>;
  amount: string;
  companyName: string;
}): Buffer {
  const { jsPDF } = require('jspdf');
  const autoTable = require('jspdf-autotable').default;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(data.companyName, 15, 20);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(`DEVIS N° ${data.quoteNumber}`, 15, 45);
  
  doc.setFontSize(10);
  doc.text(`Client: ${data.clientName}`, 15, 55);
  doc.text(`Date: ${data.quoteDate}`, 15, 62);
  
  const tableData = data.items.map(item => [
    item.description,
    item.quantity.toString(),
    item.unitPrice,
    item.total,
  ]);
  
  autoTable(doc, {
    head: [['Description', 'Quantité', 'Prix unitaire', 'Total']],
    body: tableData,
    startY: 75,
    theme: 'grid',
  });
  
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Total TTC: ${data.amount}`, 15, finalY);
  
  return Buffer.from(doc.output('arraybuffer'));
}

export function generateInvoicePDF(data: {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  items: Array<{ description: string; quantity: number; unitPrice: string; total: string }>;
  amount: string;
  companyName: string;
}): Buffer {
  const { jsPDF } = require('jspdf');
  const autoTable = require('jspdf-autotable').default;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(data.companyName, 15, 20);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(`FACTURE N° ${data.invoiceNumber}`, 15, 45);
  
  doc.setFontSize(10);
  doc.text(`Client: ${data.clientName}`, 15, 55);
  doc.text(`Date: ${data.invoiceDate}`, 15, 62);
  doc.text(`Échéance: ${data.dueDate}`, 15, 69);
  
  const tableData = data.items.map(item => [
    item.description,
    item.quantity.toString(),
    item.unitPrice,
    item.total,
  ]);
  
  autoTable(doc, {
    head: [['Description', 'Quantité', 'Prix unitaire', 'Total']],
    body: tableData,
    startY: 80,
    theme: 'grid',
  });
  
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Total TTC: ${data.amount}`, 15, finalY);
  
  return Buffer.from(doc.output('arraybuffer'));
}
