// Local authentication with email/password
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./localAuth";
import { insertServiceSchema, insertQuoteSchema, insertInvoiceSchema, insertReservationSchema, type User } from "@shared/schema";

// WebSocket clients map
const wsClients = new Map<string, WebSocket>();

// Utility function to sanitize user objects (remove password)
function sanitizeUser<T extends User>(user: T): Omit<T, 'password'> {
  const { password, ...sanitized } = user;
  return sanitized;
}

function sanitizeUsers<T extends User>(users: T[]): Omit<T, 'password'>[] {
  return users.map(sanitizeUser);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Sanitize user object - remove password before sending to client
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Service routes (public read, admin write)
  app.get("/api/services", isAuthenticated, async (req, res) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.get("/api/admin/services", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.post("/api/admin/services", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validatedData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(validatedData);
      res.json(service);
    } catch (error: any) {
      console.error("Error creating service:", error);
      res.status(400).json({ message: error.message || "Failed to create service" });
    }
  });

  app.patch("/api/admin/services/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const service = await storage.updateService(id, req.body);
      res.json(service);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/admin/services/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteService(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // Quote routes
  app.get("/api/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const quotes = await storage.getQuotes(userId);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.post("/api/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertQuoteSchema.parse({
        ...req.body,
        clientId: userId,
        status: "pending",
      });
      const quote = await storage.createQuote(validatedData);
      
      // Send notification to admins (in a real app, you'd get admin user IDs)
      // For now, we'll skip this as we don't have a way to get all admin IDs
      
      res.json(quote);
    } catch (error: any) {
      console.error("Error creating quote:", error);
      res.status(400).json({ message: error.message || "Failed to create quote" });
    }
  });

  app.get("/api/admin/quotes", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const quotes = await storage.getQuotes();
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.post("/api/admin/quotes", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { mediaFiles, wheelCount, diameter, priceExcludingTax, taxRate, taxAmount, productDetails, quoteAmount, ...quoteData } = req.body;
      
      // Validate minimum 6 images requirement
      if (!mediaFiles || !Array.isArray(mediaFiles)) {
        return res.status(400).json({ message: "Media files are required" });
      }
      
      const imageCount = mediaFiles.filter((f: any) => f.type.startsWith('image/')).length;
      if (imageCount < 6) {
        return res.status(400).json({ 
          message: `Au moins 6 images sont requises (${imageCount}/6 fournis)` 
        });
      }
      
      const validatedData = insertQuoteSchema.parse({
        ...quoteData,
        wheelCount: wheelCount ? parseInt(wheelCount) : null,
        diameter,
        priceExcludingTax,
        taxRate,
        taxAmount,
        productDetails,
        quoteAmount,
        status: "pending",
      });
      const quote = await storage.createQuote(validatedData);
      
      // Create media entries
      for (const file of mediaFiles) {
        await storage.createQuoteMedia({
          quoteId: quote.id,
          filePath: file.key,
          fileType: file.type.startsWith('image/') ? 'image' : 'video',
          fileName: file.name,
        });
      }
      
      // Create notification for client
      await storage.createNotification({
        userId: quote.clientId,
        type: "quote",
        title: "Nouveau devis",
        message: `Un devis a été créé pour vous`,
        relatedId: quote.id,
      });

      // Send WebSocket notification
      const client = wsClients.get(quote.clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: "quote_updated",
          quoteId: quote.id,
          status: quote.status,
        }));
      }
      
      res.json(quote);
    } catch (error: any) {
      console.error("Error creating quote:", error);
      res.status(400).json({ message: error.message || "Failed to create quote" });
    }
  });

  app.patch("/api/admin/quotes/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const quote = await storage.updateQuote(id, req.body);
      
      // Create notification for client
      await storage.createNotification({
        userId: quote.clientId,
        type: "quote",
        title: "Quote Updated",
        message: `Your quote has been ${quote.status}`,
        relatedId: quote.id,
      });

      // Send WebSocket notification
      const client = wsClients.get(quote.clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: "quote_updated",
          quoteId: quote.id,
          status: quote.status,
        }));
      }
      
      res.json(quote);
    } catch (error) {
      console.error("Error updating quote:", error);
      res.status(500).json({ message: "Failed to update quote" });
    }
  });

  // Quote Items routes
  app.get("/api/admin/quotes/:id/items", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const items = await storage.getQuoteItems(id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching quote items:", error);
      res.status(500).json({ message: "Failed to fetch quote items" });
    }
  });

  app.post("/api/admin/quotes/:id/items", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { insertQuoteItemSchema } = await import("@shared/schema");
      const validatedData = insertQuoteItemSchema.parse({ ...req.body, quoteId: id });
      const item = await storage.createQuoteItem(validatedData);
      // Recalculate quote totals after creating item
      await storage.recalculateQuoteTotals(id);
      res.json(item);
    } catch (error: any) {
      console.error("Error creating quote item:", error);
      res.status(400).json({ message: error.message || "Failed to create quote item" });
    }
  });

  app.patch("/api/admin/quote-items/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.updateQuoteItem(id, req.body);
      // Recalculate quote totals after updating item
      await storage.recalculateQuoteTotals(item.quoteId);
      res.json(item);
    } catch (error: any) {
      console.error("Error updating quote item:", error);
      res.status(400).json({ message: error.message || "Failed to update quote item" });
    }
  });

  app.delete("/api/admin/quote-items/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      // Get item first to know its quoteId for recalculation
      const itemToDelete = await storage.getQuoteItem(id);
      if (!itemToDelete) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      await storage.deleteQuoteItem(id);
      // Recalculate quote totals after deleting item
      await storage.recalculateQuoteTotals(itemToDelete.quoteId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting quote item:", error);
      res.status(400).json({ message: error.message || "Failed to delete quote item" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const invoices = await storage.getInvoices(userId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/admin/invoices", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post("/api/admin/invoices", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { mediaFiles, ...invoiceData } = req.body;
      
      // Validate minimum 6 images requirement
      if (!mediaFiles || !Array.isArray(mediaFiles)) {
        return res.status(400).json({ message: "Media files are required" });
      }
      
      const imageCount = mediaFiles.filter((f: any) => f.type.startsWith('image/')).length;
      if (imageCount < 6) {
        return res.status(400).json({ 
          message: `Au moins 6 images sont requises (${imageCount}/6 fournis)` 
        });
      }
      
      const validatedData = insertInvoiceSchema.parse(invoiceData);
      
      // Get quote to determine payment method and copy details
      const quote = await storage.getQuote(validatedData.quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Atomically get next invoice number (handles initialization and increment)
      const paymentType = quote.paymentMethod === "cash" ? "cash" : "other";
      const counter = await storage.incrementInvoiceCounter(paymentType);
      
      // Generate invoice number: MY-INV-ESP00000001 or MY-INV-OTH00000001
      const prefix = paymentType === "cash" ? "MY-INV-ESP" : "MY-INV-OTH";
      const paddedNumber = counter.currentNumber.toString().padStart(8, "0");
      const invoiceNumber = `${prefix}${paddedNumber}`;
      
      // Create invoice with generated number and copy details from quote
      const invoice = await storage.createInvoice({
        ...validatedData,
        invoiceNumber,
        wheelCount: quote.wheelCount,
        diameter: quote.diameter,
        priceExcludingTax: quote.priceExcludingTax,
        taxRate: quote.taxRate,
        taxAmount: quote.taxAmount,
        productDetails: quote.productDetails,
      });
      
      // Create media entries
      for (const file of mediaFiles) {
        await storage.createInvoiceMedia({
          invoiceId: invoice.id,
          filePath: file.key,
          fileType: file.type.startsWith('image/') ? 'image' : 'video',
          fileName: file.name,
        });
      }

      // Create notification for client
      await storage.createNotification({
        userId: invoice.clientId,
        type: "invoice",
        title: "New Invoice",
        message: `A new invoice has been generated`,
        relatedId: invoice.id,
      });

      // Send WebSocket notification
      const client = wsClients.get(invoice.clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: "invoice_created",
          invoiceId: invoice.id,
        }));
      }
      
      res.json(invoice);
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      res.status(400).json({ message: error.message || "Failed to create invoice" });
    }
  });

  // Invoice Items routes
  app.get("/api/admin/invoices/:id/items", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const items = await storage.getInvoiceItems(id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching invoice items:", error);
      res.status(500).json({ message: "Failed to fetch invoice items" });
    }
  });

  app.post("/api/admin/invoices/:id/items", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { insertInvoiceItemSchema } = await import("@shared/schema");
      const validatedData = insertInvoiceItemSchema.parse({ ...req.body, invoiceId: id });
      const item = await storage.createInvoiceItem(validatedData);
      // Recalculate invoice totals after creating item
      await storage.recalculateInvoiceTotals(id);
      res.json(item);
    } catch (error: any) {
      console.error("Error creating invoice item:", error);
      res.status(400).json({ message: error.message || "Failed to create invoice item" });
    }
  });

  app.patch("/api/admin/invoice-items/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.updateInvoiceItem(id, req.body);
      // Recalculate invoice totals after updating item
      await storage.recalculateInvoiceTotals(item.invoiceId);
      res.json(item);
    } catch (error: any) {
      console.error("Error updating invoice item:", error);
      res.status(400).json({ message: error.message || "Failed to update invoice item" });
    }
  });

  app.delete("/api/admin/invoice-items/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      // Get item first to know its invoiceId for recalculation
      const itemToDelete = await storage.getInvoiceItem(id);
      if (!itemToDelete) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      await storage.deleteInvoiceItem(id);
      // Recalculate invoice totals after deleting item
      await storage.recalculateInvoiceTotals(itemToDelete.invoiceId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting invoice item:", error);
      res.status(400).json({ message: error.message || "Failed to delete invoice item" });
    }
  });

  // Reservation routes
  app.get("/api/reservations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const reservations = await storage.getReservations(userId);
      res.json(reservations);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      res.status(500).json({ message: "Failed to fetch reservations" });
    }
  });

  app.get("/api/admin/reservations", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const reservations = await storage.getReservations();
      res.json(reservations);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      res.status(500).json({ message: "Failed to fetch reservations" });
    }
  });

  app.post("/api/admin/reservations", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validatedData = insertReservationSchema.parse(req.body);
      const reservation = await storage.createReservation(validatedData);

      // Create notification for client
      await storage.createNotification({
        userId: reservation.clientId,
        type: "reservation",
        title: "Reservation Confirmed",
        message: `Your reservation has been confirmed`,
        relatedId: reservation.id,
      });

      // Send WebSocket notification
      const client = wsClients.get(reservation.clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: "reservation_confirmed",
          reservationId: reservation.id,
        }));
      }
      
      res.json(reservation);
    } catch (error: any) {
      console.error("Error creating reservation:", error);
      res.status(400).json({ message: error.message || "Failed to create reservation" });
    }
  });

  // Notification routes
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.markNotificationAsRead(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Admin users route
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Sanitize all users - remove passwords
      res.json(sanitizeUsers(users));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        role: z.enum(["client", "client_professionnel", "employe", "admin"]).optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      });
      const validatedData = updateSchema.parse(req.body);
      const user = await storage.updateUser(id, validatedData);
      res.json(sanitizeUser(user));
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(400).json({ message: error.message || "Failed to update user" });
    }
  });

  app.post("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: z.enum(["client", "client_professionnel", "employe", "admin"]).optional(),
      });
      const validatedData = createSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      res.json(sanitizeUser(user));
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(400).json({ message: error.message || "Failed to create user" });
    }
  });

  app.delete("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(400).json({ message: error.message || "Failed to delete user" });
    }
  });

  // Application Settings routes
  app.get("/api/admin/settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      let settings = await storage.getApplicationSettings();
      
      // If no settings exist, create default settings
      if (!settings) {
        settings = await storage.createOrUpdateApplicationSettings({});
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching application settings:", error);
      res.status(500).json({ message: "Failed to fetch application settings" });
    }
  });

  app.patch("/api/admin/settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const settings = await storage.createOrUpdateApplicationSettings(req.body);
      res.json(settings);
    } catch (error: any) {
      console.error("Error updating application settings:", error);
      res.status(400).json({ message: error.message || "Failed to update application settings" });
    }
  });

  // Cache clearing route
  app.post("/api/admin/cache/clear", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Clear any server-side caches here
      // For now, we'll just return success
      // In the future, you could add Redis cache clearing, etc.
      
      res.json({ success: true, message: "Cache cleared successfully" });
    } catch (error: any) {
      console.error("Error clearing cache:", error);
      res.status(500).json({ message: error.message || "Failed to clear cache" });
    }
  });

  // Object Storage routes (Reference: javascript_object_storage blueprint)
  const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");

  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: (await import("./objectAcl")).ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/quote-media", isAuthenticated, async (req, res) => {
    if (!req.body.mediaURL) {
      return res.status(400).json({ error: "mediaURL is required" });
    }

    const userId = (req as any).user.id;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.mediaURL,
        {
          owner: userId,
          visibility: "private",
        },
      );

      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting media ACL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server setup (Reference: javascript_websocket blueprint)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: any) => {
    console.log('WebSocket client connected');

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'authenticate' && data.userId) {
          wsClients.set(data.userId, ws);
          console.log(`User ${data.userId} authenticated via WebSocket`);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Remove client from map
      for (const [userId, client] of Array.from(wsClients.entries())) {
        if (client === ws) {
          wsClients.delete(userId);
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
    });
  });

  return httpServer;
}
