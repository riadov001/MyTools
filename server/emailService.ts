// Reference: Resend integration for sending transactional emails
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(data: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const result = await client.emails.send({
      from: fromEmail || 'MyJantes <noreply@resend.dev>',
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
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
        <h2 style="color: #dc2626; margin-top: 0;">Devis N° ${data.quoteNumber}</h2>
        
        <p>Bonjour ${data.clientName},</p>
        
        <p>Veuillez trouver ci-dessous votre devis du ${data.quoteDate}.</p>
        
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
        
        <p style="margin-top: 30px;">Ce devis est valable 30 jours à compter de sa date d'émission.</p>
        
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
        <h2 style="color: #dc2626; margin-top: 0;">Facture N° ${data.invoiceNumber}</h2>
        
        <p>Bonjour ${data.clientName},</p>
        
        <p>Veuillez trouver ci-dessous votre facture du ${data.invoiceDate}.</p>
        
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
        
        <div style="margin-top: 20px; padding: 15px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
          <p style="margin: 0;"><strong>Date d'échéance:</strong> ${data.dueDate}</p>
        </div>
        
        <p style="margin-top: 30px;">Merci de procéder au règlement avant la date d'échéance.</p>
        
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
