// Reference: javascript_log_in_with_replit, javascript_database blueprints
import {
  users,
  services,
  quotes,
  quoteItems,
  invoices,
  invoiceItems,
  reservations,
  notifications,
  invoiceCounters,
  applicationSettings,
  type User,
  type UpsertUser,
  type Service,
  type InsertService,
  type Quote,
  type InsertQuote,
  type QuoteItem,
  type InsertQuoteItem,
  type Invoice,
  type InsertInvoice,
  type InvoiceItem,
  type InsertInvoiceItem,
  type Reservation,
  type InsertReservation,
  type Notification,
  type InsertNotification,
  type InvoiceCounter,
  type InsertInvoiceCounter,
  type ApplicationSettings,
  type InsertApplicationSettings,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, userData: Partial<User>): Promise<User>;
  createUser(user: { email: string; password?: string; firstName?: string; lastName?: string; role?: "client" | "client_professionnel" | "employe" | "admin"; companyName?: string; siret?: string; tvaNumber?: string; companyAddress?: string }): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // Service operations
  getServices(): Promise<Service[]>;
  getService(id: string): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: string): Promise<void>;

  // Quote operations
  getQuotes(clientId?: string): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote>;

  // Quote item operations
  getQuoteItems(quoteId: string): Promise<QuoteItem[]>;
  getQuoteItem(id: string): Promise<QuoteItem | undefined>;
  createQuoteItem(item: InsertQuoteItem): Promise<QuoteItem>;
  updateQuoteItem(id: string, item: Partial<InsertQuoteItem>): Promise<QuoteItem>;
  deleteQuoteItem(id: string): Promise<void>;
  recalculateQuoteTotals(quoteId: string): Promise<Quote>;

  // Invoice operations
  getInvoices(clientId?: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  
  // Invoice item operations
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
  createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
  updateInvoiceItem(id: string, item: Partial<InsertInvoiceItem>): Promise<InvoiceItem>;
  deleteInvoiceItem(id: string): Promise<void>;

  // Reservation operations
  getReservations(clientId?: string): Promise<Reservation[]>;
  getReservation(id: string): Promise<Reservation | undefined>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: string, reservation: Partial<InsertReservation>): Promise<Reservation>;

  // Notification operations
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;

  // Invoice counter operations
  getInvoiceCounter(paymentType: "cash" | "wire_transfer" | "card"): Promise<InvoiceCounter | undefined>;
  createInvoiceCounter(counter: InsertInvoiceCounter): Promise<InvoiceCounter>;
  incrementInvoiceCounter(paymentType: "cash" | "wire_transfer" | "card"): Promise<InvoiceCounter>;

  // Media operations
  createQuoteMedia(media: { quoteId: string; filePath: string; fileType: string; fileName?: string }): Promise<void>;
  createInvoiceMedia(media: { invoiceId: string; filePath: string; fileType: string; fileName?: string }): Promise<void>;

  // Application settings operations
  getApplicationSettings(): Promise<ApplicationSettings | undefined>;
  createOrUpdateApplicationSettings(settings: Partial<InsertApplicationSettings>): Promise<ApplicationSettings>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async createUser(userData: { email: string; password?: string; firstName?: string; lastName?: string; role?: "client" | "client_professionnel" | "employe" | "admin"; companyName?: string; siret?: string; tvaNumber?: string; companyAddress?: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || "client",
        companyName: userData.companyName,
        siret: userData.siret,
        tvaNumber: userData.tvaNumber,
        companyAddress: userData.companyAddress,
      })
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Service operations
  async getServices(): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.isActive, true)).orderBy(desc(services.createdAt));
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(serviceData: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values(serviceData).returning();
    return service;
  }

  async updateService(id: string, serviceData: Partial<InsertService>): Promise<Service> {
    const [service] = await db
      .update(services)
      .set({ ...serviceData, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning();
    return service;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  // Quote operations
  async getQuotes(clientId?: string): Promise<Quote[]> {
    if (clientId) {
      return await db.select().from(quotes).where(eq(quotes.clientId, clientId)).orderBy(desc(quotes.createdAt));
    }
    return await db.select().from(quotes).orderBy(desc(quotes.createdAt));
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async createQuote(quoteData: InsertQuote): Promise<Quote> {
    const [quote] = await db.insert(quotes).values(quoteData).returning();
    return quote;
  }

  async updateQuote(id: string, quoteData: Partial<InsertQuote>): Promise<Quote> {
    const [quote] = await db
      .update(quotes)
      .set({ ...quoteData, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return quote;
  }

  // Quote item operations
  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    return await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quoteId))
      .orderBy(quoteItems.createdAt);
  }

  async getQuoteItem(id: string): Promise<QuoteItem | undefined> {
    const [item] = await db.select().from(quoteItems).where(eq(quoteItems.id, id));
    return item;
  }

  async createQuoteItem(itemData: InsertQuoteItem): Promise<QuoteItem> {
    const [item] = await db.insert(quoteItems).values(itemData).returning();
    return item;
  }

  async updateQuoteItem(id: string, itemData: Partial<InsertQuoteItem>): Promise<QuoteItem> {
    const [item] = await db
      .update(quoteItems)
      .set({ ...itemData, updatedAt: new Date() })
      .where(eq(quoteItems.id, id))
      .returning();
    return item;
  }

  async deleteQuoteItem(id: string): Promise<void> {
    await db.delete(quoteItems).where(eq(quoteItems.id, id));
  }

  async recalculateQuoteTotals(quoteId: string): Promise<Quote> {
    // Get all items for this quote
    const items = await this.getQuoteItems(quoteId);
    
    // Calculate totals
    const totalHT = items.reduce((sum, item) => sum + parseFloat(item.totalExcludingTax || '0'), 0);
    const totalVAT = items.reduce((sum, item) => sum + parseFloat(item.taxAmount || '0'), 0);
    const totalTTC = totalHT + totalVAT;
    
    // Get average tax rate (or use first item's rate)
    const avgTaxRate = items.length > 0 ? parseFloat(items[0].taxRate || '20') : 20;
    
    // Update quote with calculated totals
    return await this.updateQuote(quoteId, {
      quoteAmount: totalTTC.toFixed(2),
      priceExcludingTax: totalHT.toFixed(2),
      taxAmount: totalVAT.toFixed(2),
      taxRate: avgTaxRate.toFixed(2),
    });
  }

  // Invoice operations
  async getInvoices(clientId?: string): Promise<Invoice[]> {
    if (clientId) {
      return await db.select().from(invoices).where(eq(invoices.clientId, clientId)).orderBy(desc(invoices.createdAt));
    }
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(invoiceData: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(invoiceData).returning();
    return invoice;
  }

  async updateInvoice(id: string, invoiceData: Partial<InsertInvoice>): Promise<Invoice> {
    const [invoice] = await db
      .update(invoices)
      .set({ ...invoiceData, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return invoice;
  }

  // Invoice item operations
  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    return await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId))
      .orderBy(invoiceItems.createdAt);
  }

  async getInvoiceItem(id: string): Promise<InvoiceItem | undefined> {
    const [item] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, id));
    return item;
  }

  async createInvoiceItem(itemData: InsertInvoiceItem): Promise<InvoiceItem> {
    const [item] = await db.insert(invoiceItems).values(itemData).returning();
    return item;
  }

  async updateInvoiceItem(id: string, itemData: Partial<InsertInvoiceItem>): Promise<InvoiceItem> {
    const [item] = await db
      .update(invoiceItems)
      .set({ ...itemData, updatedAt: new Date() })
      .where(eq(invoiceItems.id, id))
      .returning();
    return item;
  }

  async deleteInvoiceItem(id: string): Promise<void> {
    await db.delete(invoiceItems).where(eq(invoiceItems.id, id));
  }

  async recalculateInvoiceTotals(invoiceId: string): Promise<Invoice> {
    // Get all items for this invoice
    const items = await this.getInvoiceItems(invoiceId);
    
    // Calculate totals
    const totalHT = items.reduce((sum, item) => sum + parseFloat(item.totalExcludingTax || '0'), 0);
    const totalVAT = items.reduce((sum, item) => sum + parseFloat(item.taxAmount || '0'), 0);
    const totalTTC = totalHT + totalVAT;
    
    // Get average tax rate (or use first item's rate)
    const avgTaxRate = items.length > 0 ? parseFloat(items[0].taxRate || '20') : 20;
    
    // Update invoice with calculated totals
    return await this.updateInvoice(invoiceId, {
      amount: totalTTC.toFixed(2),
      priceExcludingTax: totalHT.toFixed(2),
      taxAmount: totalVAT.toFixed(2),
      taxRate: avgTaxRate.toFixed(2),
    });
  }

  // Reservation operations
  async getReservations(clientId?: string): Promise<Reservation[]> {
    if (clientId) {
      return await db.select().from(reservations).where(eq(reservations.clientId, clientId)).orderBy(desc(reservations.createdAt));
    }
    return await db.select().from(reservations).orderBy(desc(reservations.createdAt));
  }

  async getReservation(id: string): Promise<Reservation | undefined> {
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id));
    return reservation;
  }

  async createReservation(reservationData: InsertReservation): Promise<Reservation> {
    const [reservation] = await db.insert(reservations).values(reservationData).returning();
    return reservation;
  }

  async updateReservation(id: string, reservationData: Partial<InsertReservation>): Promise<Reservation> {
    const [reservation] = await db
      .update(reservations)
      .set({ ...reservationData, updatedAt: new Date() })
      .where(eq(reservations.id, id))
      .returning();
    return reservation;
  }

  // Notification operations
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(notificationData).returning();
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  // Invoice counter operations
  async getInvoiceCounter(paymentType: "cash" | "wire_transfer" | "card"): Promise<InvoiceCounter | undefined> {
    const [counter] = await db.select().from(invoiceCounters).where(eq(invoiceCounters.paymentType, paymentType));
    return counter;
  }

  async createInvoiceCounter(counterData: InsertInvoiceCounter): Promise<InvoiceCounter> {
    const [counter] = await db.insert(invoiceCounters).values(counterData).returning();
    return counter;
  }

  async incrementInvoiceCounter(paymentType: "cash" | "wire_transfer" | "card"): Promise<InvoiceCounter> {
    // Atomic upsert and increment: handles both initialization and increment atomically
    const [counter] = await db
      .insert(invoiceCounters)
      .values({
        paymentType,
        currentNumber: 1, // First invoice starts at 1
      })
      .onConflictDoUpdate({
        target: invoiceCounters.paymentType,
        set: {
          currentNumber: sql`${invoiceCounters.currentNumber} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return counter;
  }

  // Media operations
  async createQuoteMedia(media: { quoteId: string; filePath: string; fileType: string; fileName?: string }): Promise<void> {
    const { quoteMedia } = await import("@shared/schema");
    await db.insert(quoteMedia).values({
      quoteId: media.quoteId,
      filePath: media.filePath,
      fileType: media.fileType as "image" | "video",
      fileName: media.fileName || media.filePath.split('/').pop() || 'unknown',
    });
  }

  async createInvoiceMedia(media: { invoiceId: string; filePath: string; fileType: string; fileName?: string }): Promise<void> {
    const { invoiceMedia } = await import("@shared/schema");
    await db.insert(invoiceMedia).values({
      invoiceId: media.invoiceId,
      filePath: media.filePath,
      fileType: media.fileType as "image" | "video",
      fileName: media.fileName || media.filePath.split('/').pop() || 'unknown',
    });
  }

  // Application settings operations
  async getApplicationSettings(): Promise<ApplicationSettings | undefined> {
    const [settings] = await db.select().from(applicationSettings).limit(1);
    return settings;
  }

  async createOrUpdateApplicationSettings(settingsData: Partial<InsertApplicationSettings>): Promise<ApplicationSettings> {
    // Check if settings exist
    const existing = await this.getApplicationSettings();
    
    if (existing) {
      // Update existing settings
      const [updated] = await db
        .update(applicationSettings)
        .set({
          ...settingsData,
          updatedAt: new Date(),
        })
        .where(eq(applicationSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [created] = await db
        .insert(applicationSettings)
        .values(settingsData as InsertApplicationSettings)
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
