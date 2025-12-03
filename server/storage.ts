import {
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
  type Engagement,
  type InsertEngagement,
  type Workflow,
  type InsertWorkflow,
  type WorkflowStep,
  type InsertWorkflowStep,
  type ServiceWorkflow,
  type InsertServiceWorkflow,
  type WorkshopTask,
  type InsertWorkshopTask,
} from "@shared/schema";
import { nanoid } from "nanoid";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, userData: Partial<User>): Promise<User>;
  createUser(user: { email: string; password?: string; firstName?: string; lastName?: string; role?: "client" | "client_professionnel" | "employe" | "admin"; companyName?: string; siret?: string; tvaNumber?: string; companyAddress?: string }): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getServices(): Promise<Service[]>;
  getService(id: string): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: string): Promise<void>;
  getQuotes(clientId?: string): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote>;
  getQuoteItems(quoteId: string): Promise<QuoteItem[]>;
  getQuoteItem(id: string): Promise<QuoteItem | undefined>;
  createQuoteItem(item: InsertQuoteItem): Promise<QuoteItem>;
  updateQuoteItem(id: string, item: Partial<InsertQuoteItem>): Promise<QuoteItem>;
  deleteQuoteItem(id: string): Promise<void>;
  recalculateQuoteTotals(quoteId: string): Promise<Quote>;
  getInvoices(clientId?: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
  getInvoiceItem(id: string): Promise<InvoiceItem | undefined>;
  createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
  updateInvoiceItem(id: string, item: Partial<InsertInvoiceItem>): Promise<InvoiceItem>;
  deleteInvoiceItem(id: string): Promise<void>;
  recalculateInvoiceTotals(invoiceId: string): Promise<Invoice>;
  getReservations(clientId?: string): Promise<Reservation[]>;
  getReservation(id: string): Promise<Reservation | undefined>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: string, reservation: Partial<InsertReservation>): Promise<Reservation>;
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
  getInvoiceCounter(paymentType: "cash" | "wire_transfer" | "card"): Promise<InvoiceCounter | undefined>;
  createInvoiceCounter(counter: InsertInvoiceCounter): Promise<InvoiceCounter>;
  incrementInvoiceCounter(paymentType: "cash" | "wire_transfer" | "card"): Promise<InvoiceCounter>;
  createQuoteMedia(media: { quoteId: string; filePath: string; fileType: string; fileName?: string }): Promise<void>;
  createInvoiceMedia(media: { invoiceId: string; filePath: string; fileType: string; fileName?: string }): Promise<void>;
  getApplicationSettings(): Promise<ApplicationSettings | undefined>;
  createOrUpdateApplicationSettings(settings: Partial<InsertApplicationSettings>): Promise<ApplicationSettings>;
  getEngagements(clientId?: string): Promise<Engagement[]>;
  getEngagement(id: string): Promise<Engagement | undefined>;
  createEngagement(engagement: InsertEngagement): Promise<Engagement>;
  updateEngagement(id: string, engagement: Partial<InsertEngagement>): Promise<Engagement>;
  getEngagementSummary(clientId: string): Promise<{ quotes: Quote[]; invoices: Invoice[]; reservations: Reservation[] }>;
  createWorkflow(workflowData: InsertWorkflow): Promise<Workflow>;
  getWorkflows(): Promise<Workflow[]>;
  updateWorkflow(id: string, workflowData: Partial<InsertWorkflow>): Promise<Workflow>;
  deleteWorkflow(id: string): Promise<void>;
  createWorkflowStep(stepData: InsertWorkflowStep): Promise<WorkflowStep>;
  getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]>;
  updateWorkflowStep(id: string, stepData: Partial<InsertWorkflowStep>): Promise<WorkflowStep>;
  deleteWorkflowStep(id: string): Promise<void>;
  assignWorkflowToService(serviceWorkflowData: InsertServiceWorkflow): Promise<ServiceWorkflow>;
  getServiceWorkflows(serviceId: string): Promise<Workflow[]>;
  deleteServiceWorkflow(serviceId: string, workflowId: string): Promise<void>;
  createWorkshopTask(taskData: InsertWorkshopTask): Promise<WorkshopTask>;
  updateWorkshopTask(id: string, taskData: Partial<InsertWorkshopTask>): Promise<WorkshopTask>;
  getReservationTasks(reservationId: string): Promise<(WorkshopTask & { step: WorkflowStep })[]>;
  initializeReservationWorkflow(reservationId: string, workflowSteps: WorkflowStep[]): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private services: Map<string, Service> = new Map();
  private quotes: Map<string, Quote> = new Map();
  private quoteItems: Map<string, QuoteItem> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private invoiceItems: Map<string, InvoiceItem> = new Map();
  private reservations: Map<string, Reservation> = new Map();
  private notifications: Map<string, Notification> = new Map();
  private invoiceCounters: Map<string, InvoiceCounter> = new Map();
  private applicationSettings: Map<string, ApplicationSettings> = new Map();
  private engagements: Map<string, Engagement> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private workflowSteps: Map<string, WorkflowStep> = new Map();
  private serviceWorkflows: Map<string, ServiceWorkflow> = new Map();
  private workshopTasks: Map<string, WorkshopTask> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = this.users.get(userData.id);
    const now = new Date();
    const user: User = {
      id: userData.id,
      email: userData.email,
      password: userData.password || existing?.password,
      firstName: userData.firstName || existing?.firstName,
      lastName: userData.lastName || existing?.lastName,
      role: userData.role || existing?.role || "client",
      companyName: userData.companyName || existing?.companyName,
      siret: userData.siret || existing?.siret,
      tvaNumber: userData.tvaNumber || existing?.tvaNumber,
      companyAddress: userData.companyAddress || existing?.companyAddress,
      phone: userData.phone || existing?.phone,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.users.set(userData.id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    const updated: User = { ...user, ...userData, id, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async createUser(userData: { email: string; password?: string; firstName?: string; lastName?: string; role?: "client" | "client_professionnel" | "employe" | "admin"; companyName?: string; siret?: string; tvaNumber?: string; companyAddress?: string }): Promise<User> {
    const id = nanoid();
    const now = new Date();
    const user: User = {
      id,
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role || "client",
      companyName: userData.companyName,
      siret: userData.siret,
      tvaNumber: userData.tvaNumber,
      companyAddress: userData.companyAddress,
      phone: undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  async getServices(): Promise<Service[]> {
    return Array.from(this.services.values())
      .filter(s => s.isActive !== false)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getService(id: string): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async createService(serviceData: InsertService): Promise<Service> {
    const id = nanoid();
    const now = new Date();
    const service: Service = {
      id,
      ...serviceData,
      createdAt: now,
      updatedAt: now,
    } as Service;
    this.services.set(id, service);
    return service;
  }

  async updateService(id: string, serviceData: Partial<InsertService>): Promise<Service> {
    const service = this.services.get(id);
    if (!service) throw new Error("Service not found");
    const updated: Service = { ...service, ...serviceData, updatedAt: new Date() };
    this.services.set(id, updated);
    return updated;
  }

  async deleteService(id: string): Promise<void> {
    this.services.delete(id);
  }

  async getQuotes(clientId?: string): Promise<Quote[]> {
    let results = Array.from(this.quotes.values());
    if (clientId) results = results.filter(q => q.clientId === clientId);
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    return this.quotes.get(id);
  }

  async createQuote(quoteData: InsertQuote): Promise<Quote> {
    const id = nanoid();
    const now = new Date();
    const quote: Quote = {
      id,
      ...quoteData,
      createdAt: now,
      updatedAt: now,
    } as Quote;
    this.quotes.set(id, quote);
    return quote;
  }

  async updateQuote(id: string, quoteData: Partial<InsertQuote>): Promise<Quote> {
    const quote = this.quotes.get(id);
    if (!quote) throw new Error("Quote not found");
    const updated: Quote = { ...quote, ...quoteData, updatedAt: new Date() };
    this.quotes.set(id, updated);
    return updated;
  }

  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    return Array.from(this.quoteItems.values())
      .filter(qi => qi.quoteId === quoteId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getQuoteItem(id: string): Promise<QuoteItem | undefined> {
    return this.quoteItems.get(id);
  }

  async createQuoteItem(itemData: InsertQuoteItem): Promise<QuoteItem> {
    const id = nanoid();
    const now = new Date();
    const item: QuoteItem = {
      id,
      ...itemData,
      createdAt: now,
      updatedAt: now,
    } as QuoteItem;
    this.quoteItems.set(id, item);
    return item;
  }

  async updateQuoteItem(id: string, itemData: Partial<InsertQuoteItem>): Promise<QuoteItem> {
    const item = this.quoteItems.get(id);
    if (!item) throw new Error("Quote item not found");
    const updated: QuoteItem = { ...item, ...itemData, updatedAt: new Date() };
    this.quoteItems.set(id, updated);
    return updated;
  }

  async deleteQuoteItem(id: string): Promise<void> {
    this.quoteItems.delete(id);
  }

  async recalculateQuoteTotals(quoteId: string): Promise<Quote> {
    const items = await this.getQuoteItems(quoteId);
    const totalHT = items.reduce((sum, item) => sum + parseFloat(item.totalExcludingTax || '0'), 0);
    const totalVAT = items.reduce((sum, item) => sum + parseFloat(item.taxAmount || '0'), 0);
    const totalTTC = totalHT + totalVAT;
    const avgTaxRate = items.length > 0 ? parseFloat(items[0].taxRate || '20') : 20;
    
    return await this.updateQuote(quoteId, {
      quoteAmount: totalTTC.toFixed(2),
      priceExcludingTax: totalHT.toFixed(2),
      taxAmount: totalVAT.toFixed(2),
      taxRate: avgTaxRate.toFixed(2),
    });
  }

  async getInvoices(clientId?: string): Promise<Invoice[]> {
    let results = Array.from(this.invoices.values());
    if (clientId) results = results.filter(i => i.clientId === clientId);
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async createInvoice(invoiceData: InsertInvoice): Promise<Invoice> {
    const paymentType = invoiceData.paymentMethod || "wire_transfer";
    const counter = await this.incrementInvoiceCounter(paymentType);
    const invoiceNumber = `${paymentType === "cash" ? "CV" : paymentType === "card" ? "CB" : "VI"}-${String(counter.currentNumber).padStart(6, "0")}`;
    
    const id = nanoid();
    const now = new Date();
    const invoice: Invoice = {
      id,
      ...invoiceData,
      invoiceNumber,
      createdAt: now,
      updatedAt: now,
    } as Invoice;
    this.invoices.set(id, invoice);
    return invoice;
  }

  async updateInvoice(id: string, invoiceData: Partial<InsertInvoice>): Promise<Invoice> {
    const invoice = this.invoices.get(id);
    if (!invoice) throw new Error("Invoice not found");
    const updated: Invoice = { ...invoice, ...invoiceData, updatedAt: new Date() };
    this.invoices.set(id, updated);
    return updated;
  }

  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    return Array.from(this.invoiceItems.values())
      .filter(ii => ii.invoiceId === invoiceId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createInvoiceItem(itemData: InsertInvoiceItem): Promise<InvoiceItem> {
    const id = nanoid();
    const now = new Date();
    const item: InvoiceItem = {
      id,
      ...itemData,
      createdAt: now,
      updatedAt: now,
    } as InvoiceItem;
    this.invoiceItems.set(id, item);
    return item;
  }

  async updateInvoiceItem(id: string, itemData: Partial<InsertInvoiceItem>): Promise<InvoiceItem> {
    const item = this.invoiceItems.get(id);
    if (!item) throw new Error("Invoice item not found");
    const updated: InvoiceItem = { ...item, ...itemData, updatedAt: new Date() };
    this.invoiceItems.set(id, updated);
    return updated;
  }

  async deleteInvoiceItem(id: string): Promise<void> {
    this.invoiceItems.delete(id);
  }

  async getReservations(clientId?: string): Promise<Reservation[]> {
    let results = Array.from(this.reservations.values());
    if (clientId) results = results.filter(r => r.clientId === clientId);
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getReservation(id: string): Promise<Reservation | undefined> {
    return this.reservations.get(id);
  }

  async createReservation(reservationData: InsertReservation): Promise<Reservation> {
    const id = nanoid();
    const now = new Date();
    const reservation: Reservation = {
      id,
      ...reservationData,
      createdAt: now,
      updatedAt: now,
    } as Reservation;
    this.reservations.set(id, reservation);
    return reservation;
  }

  async updateReservation(id: string, reservationData: Partial<InsertReservation>): Promise<Reservation> {
    const reservation = this.reservations.get(id);
    if (!reservation) throw new Error("Reservation not found");
    const updated: Reservation = { ...reservation, ...reservationData, updatedAt: new Date() };
    this.reservations.set(id, updated);
    return updated;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const id = nanoid();
    const now = new Date();
    const notification: Notification = {
      id,
      ...notificationData,
      isRead: false,
      createdAt: now,
      updatedAt: now,
    } as Notification;
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.isRead = true;
      notification.updatedAt = new Date();
    }
  }

  async getInvoiceCounter(paymentType: "cash" | "wire_transfer" | "card"): Promise<InvoiceCounter | undefined> {
    return this.invoiceCounters.get(paymentType);
  }

  async createInvoiceCounter(counterData: InsertInvoiceCounter): Promise<InvoiceCounter> {
    const now = new Date();
    const counter: InvoiceCounter = {
      id: nanoid(),
      ...counterData,
      createdAt: now,
      updatedAt: now,
    } as InvoiceCounter;
    this.invoiceCounters.set(counterData.paymentType, counter);
    return counter;
  }

  async incrementInvoiceCounter(paymentType: "cash" | "wire_transfer" | "card"): Promise<InvoiceCounter> {
    let counter = this.invoiceCounters.get(paymentType);
    if (!counter) {
      counter = await this.createInvoiceCounter({ paymentType, currentNumber: 1 });
    } else {
      counter.currentNumber = (counter.currentNumber || 0) + 1;
      counter.updatedAt = new Date();
    }
    return counter;
  }

  async createQuoteMedia(media: { quoteId: string; filePath: string; fileType: string; fileName?: string }): Promise<void> {
    // In-memory storage doesn't track media separately
  }

  async createInvoiceMedia(media: { invoiceId: string; filePath: string; fileType: string; fileName?: string }): Promise<void> {
    // In-memory storage doesn't track media separately
  }

  async getApplicationSettings(): Promise<ApplicationSettings | undefined> {
    for (const settings of this.applicationSettings.values()) {
      return settings;
    }
    return undefined;
  }

  async createOrUpdateApplicationSettings(settingsData: Partial<InsertApplicationSettings>): Promise<ApplicationSettings> {
    const existing = await this.getApplicationSettings();
    const now = new Date();
    
    if (existing) {
      const updated: ApplicationSettings = { ...existing, ...settingsData, updatedAt: now };
      this.applicationSettings.set(existing.id, updated);
      return updated;
    } else {
      const id = nanoid();
      const created: ApplicationSettings = {
        id,
        ...settingsData,
        createdAt: now,
        updatedAt: now,
      } as ApplicationSettings;
      this.applicationSettings.set(id, created);
      return created;
    }
  }

  async getEngagements(clientId?: string): Promise<Engagement[]> {
    let results = Array.from(this.engagements.values());
    if (clientId) results = results.filter(e => e.clientId === clientId);
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getEngagement(id: string): Promise<Engagement | undefined> {
    return this.engagements.get(id);
  }

  async createEngagement(engagementData: InsertEngagement): Promise<Engagement> {
    const id = nanoid();
    const now = new Date();
    const engagement: Engagement = {
      id,
      ...engagementData,
      createdAt: now,
      updatedAt: now,
    } as Engagement;
    this.engagements.set(id, engagement);
    return engagement;
  }

  async updateEngagement(id: string, engagementData: Partial<InsertEngagement>): Promise<Engagement> {
    const engagement = this.engagements.get(id);
    if (!engagement) throw new Error("Engagement not found");
    const updated: Engagement = { ...engagement, ...engagementData, updatedAt: new Date() };
    this.engagements.set(id, updated);
    return updated;
  }

  async getEngagementSummary(clientId: string): Promise<{ quotes: Quote[]; invoices: Invoice[]; reservations: Reservation[] }> {
    const quotes = Array.from(this.quotes.values()).filter(q => q.clientId === clientId);
    const invoices = Array.from(this.invoices.values()).filter(i => i.clientId === clientId);
    const reservations = Array.from(this.reservations.values()).filter(r => r.clientId === clientId);
    return { quotes, invoices, reservations };
  }

  async createWorkflow(workflowData: InsertWorkflow): Promise<Workflow> {
    const id = nanoid();
    const now = new Date();
    const workflow: Workflow = {
      id,
      ...workflowData,
      createdAt: now,
      updatedAt: now,
    } as Workflow;
    this.workflows.set(id, workflow);
    return workflow;
  }

  async getWorkflows(): Promise<Workflow[]> {
    return Array.from(this.workflows.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateWorkflow(id: string, workflowData: Partial<InsertWorkflow>): Promise<Workflow> {
    const workflow = this.workflows.get(id);
    if (!workflow) throw new Error("Workflow not found");
    const updated: Workflow = { ...workflow, ...workflowData, updatedAt: new Date() };
    this.workflows.set(id, updated);
    return updated;
  }

  async deleteWorkflow(id: string): Promise<void> {
    this.workflows.delete(id);
  }

  async createWorkflowStep(stepData: InsertWorkflowStep): Promise<WorkflowStep> {
    const id = nanoid();
    const now = new Date();
    const step: WorkflowStep = {
      id,
      ...stepData,
      createdAt: now,
      updatedAt: now,
    } as WorkflowStep;
    this.workflowSteps.set(id, step);
    return step;
  }

  async getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
    return Array.from(this.workflowSteps.values())
      .filter(ws => ws.workflowId === workflowId)
      .sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0));
  }

  async updateWorkflowStep(id: string, stepData: Partial<InsertWorkflowStep>): Promise<WorkflowStep> {
    const step = this.workflowSteps.get(id);
    if (!step) throw new Error("Workflow step not found");
    const updated: WorkflowStep = { ...step, ...stepData, updatedAt: new Date() };
    this.workflowSteps.set(id, updated);
    return updated;
  }

  async deleteWorkflowStep(id: string): Promise<void> {
    this.workflowSteps.delete(id);
  }

  async assignWorkflowToService(serviceWorkflowData: InsertServiceWorkflow): Promise<ServiceWorkflow> {
    const id = nanoid();
    const now = new Date();
    const sw: ServiceWorkflow = {
      id,
      ...serviceWorkflowData,
      createdAt: now,
      updatedAt: now,
    } as ServiceWorkflow;
    this.serviceWorkflows.set(id, sw);
    return sw;
  }

  async getServiceWorkflows(serviceId: string): Promise<Workflow[]> {
    const serviceWorkflowsList = Array.from(this.serviceWorkflows.values())
      .filter(sw => sw.serviceId === serviceId);
    const workflowIds = serviceWorkflowsList.map(sw => sw.workflowId);
    if (workflowIds.length === 0) return [];
    return Array.from(this.workflows.values())
      .filter(w => workflowIds.includes(w.id));
  }

  async deleteServiceWorkflow(serviceId: string, workflowId: string): Promise<void> {
    for (const [key, sw] of this.serviceWorkflows.entries()) {
      if (sw.serviceId === serviceId && sw.workflowId === workflowId) {
        this.serviceWorkflows.delete(key);
      }
    }
  }

  async createWorkshopTask(taskData: InsertWorkshopTask): Promise<WorkshopTask> {
    const id = nanoid();
    const now = new Date();
    const task: WorkshopTask = {
      id,
      ...taskData,
      createdAt: now,
      updatedAt: now,
    } as WorkshopTask;
    this.workshopTasks.set(id, task);
    return task;
  }

  async getReservationTasks(reservationId: string): Promise<(WorkshopTask & { step: WorkflowStep })[]> {
    const tasks = Array.from(this.workshopTasks.values())
      .filter(t => t.reservationId === reservationId);
    
    return Promise.all(tasks.map(async (task) => {
      const step = this.workflowSteps.get(task.workflowStepId);
      return { ...task, step: step! };
    }));
  }

  async getInvoiceItem(id: string): Promise<InvoiceItem | undefined> {
    return this.invoiceItems.get(id);
  }

  async recalculateInvoiceTotals(invoiceId: string): Promise<Invoice> {
    const items = await this.getInvoiceItems(invoiceId);
    const totalHT = items.reduce((sum, item) => sum + parseFloat(item.totalExcludingTax || '0'), 0);
    const totalVAT = items.reduce((sum, item) => sum + parseFloat(item.taxAmount || '0'), 0);
    const totalTTC = totalHT + totalVAT;
    const avgTaxRate = items.length > 0 ? parseFloat(items[0].taxRate || '20') : 20;
    
    return await this.updateInvoice(invoiceId, {
      amount: totalTTC.toFixed(2),
      priceExcludingTax: totalHT.toFixed(2),
      taxAmount: totalVAT.toFixed(2),
      taxRate: avgTaxRate.toFixed(2),
    });
  }

  async updateWorkshopTask(id: string, taskData: Partial<InsertWorkshopTask>): Promise<WorkshopTask> {
    const task = this.workshopTasks.get(id);
    if (!task) throw new Error("Workshop task not found");
    const updated: WorkshopTask = { ...task, ...taskData, updatedAt: new Date() };
    this.workshopTasks.set(id, updated);
    return updated;
  }

  async initializeReservationWorkflow(reservationId: string, workflowSteps: WorkflowStep[]): Promise<void> {
    for (const step of workflowSteps) {
      await this.createWorkshopTask({
        reservationId,
        workflowStepId: step.id,
        isCompleted: false,
      });
    }
  }
}

export const storage = new MemStorage();
