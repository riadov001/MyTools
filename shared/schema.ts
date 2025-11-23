// MyJantes Database Schema
// References: javascript_log_in_with_replit, javascript_database blueprints

import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (Required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password", { length: 255 }), // Hashed password
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { enum: ["client", "client_professionnel", "employe", "admin"] }).notNull().default("client"),
  // Champs pour clients professionnels
  companyName: varchar("company_name"),
  siret: varchar("siret", { length: 14 }),
  tvaNumber: varchar("tva_number", { length: 20 }),
  companyAddress: text("company_address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Services offered
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
  category: varchar("category", { length: 100 }),
  isActive: boolean("is_active").notNull().default(true),
  customFormFields: jsonb("custom_form_fields"), // Array of field definitions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quote requests
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: 'cascade' }),
  status: varchar("status", { enum: ["pending", "approved", "rejected", "completed"] }).notNull().default("pending"),
  paymentMethod: varchar("payment_method", { enum: ["cash", "wire_transfer", "card"] }).notNull().default("wire_transfer"),
  requestDetails: jsonb("request_details"), // Custom form data from client
  quoteAmount: decimal("quote_amount", { precision: 10, scale: 2 }),
  wheelCount: integer("wheel_count"), // Number of wheels: 1, 2, 3, or 4
  diameter: varchar("diameter", { length: 50 }), // Wheel diameter
  priceExcludingTax: decimal("price_excluding_tax", { precision: 10, scale: 2 }), // Prix HT
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }), // TVA rate (e.g., 20.00 for 20%)
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }), // TVA amount
  productDetails: text("product_details"), // Details about products
  notes: text("notes"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quote Items (lignes de devis)
export const quoteItems = pgTable("quote_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPriceExcludingTax: decimal("unit_price_excluding_tax", { precision: 10, scale: 2 }).notNull(),
  totalExcludingTax: decimal("total_excluding_tax", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
  totalIncludingTax: decimal("total_including_tax", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: 'cascade' }), // Optional - nullable for direct invoices
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { enum: ["cash", "wire_transfer", "card"] }).notNull().default("wire_transfer"), // Required for direct invoices
  wheelCount: integer("wheel_count"), // Number of wheels: 1, 2, 3, or 4
  diameter: varchar("diameter", { length: 50 }), // Wheel diameter
  priceExcludingTax: decimal("price_excluding_tax", { precision: 10, scale: 2 }), // Prix HT
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }), // TVA rate (e.g., 20.00 for 20%)
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }), // TVA amount
  productDetails: text("product_details"), // Details about products
  status: varchar("status", { enum: ["pending", "paid", "overdue", "cancelled"] }).notNull().default("pending"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice Items (lignes de facture)
export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPriceExcludingTax: decimal("unit_price_excluding_tax", { precision: 10, scale: 2 }).notNull(),
  totalExcludingTax: decimal("total_excluding_tax", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
  totalIncludingTax: decimal("total_including_tax", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reservations
export const reservations = pgTable("reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: 'cascade' }), // Optional - nullable for direct reservations
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: 'cascade' }),
  scheduledDate: timestamp("scheduled_date").notNull(),
  wheelCount: integer("wheel_count"), // Number of wheels: 1, 2, 3, or 4
  diameter: varchar("diameter", { length: 50 }), // Wheel diameter
  priceExcludingTax: decimal("price_excluding_tax", { precision: 10, scale: 2 }), // Prix HT
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }), // TVA rate (e.g., 20.00 for 20%)
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }), // TVA amount
  productDetails: text("product_details"), // Details about products
  status: varchar("status", { enum: ["pending", "confirmed", "completed", "cancelled"] }).notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar("type", { enum: ["quote", "invoice", "reservation", "service"] }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  relatedId: varchar("related_id"), // ID of related quote/invoice/reservation
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoice counters for incremental numbering
export const invoiceCounters = pgTable("invoice_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentType: varchar("payment_type", { enum: ["cash", "wire_transfer", "card"] }).notNull().unique(),
  currentNumber: integer("current_number").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Media files for quotes (images and videos)
export const quoteMedia = pgTable("quote_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  fileType: varchar("file_type", { enum: ["image", "video"] }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Media files for invoices (images and videos)
export const invoiceMedia = pgTable("invoice_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  fileType: varchar("file_type", { enum: ["image", "video"] }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Application Settings (singleton table for app-wide configuration)
export const applicationSettings = pgTable("application_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  defaultWheelCount: integer("default_wheel_count").notNull().default(4), // Default: 4 jantes
  defaultDiameter: varchar("default_diameter", { length: 50 }).notNull().default("17"), // Default diameter
  defaultTaxRate: decimal("default_tax_rate", { precision: 5, scale: 2 }).notNull().default("20.00"), // Default: 20% TVA
  wheelCountOptions: varchar("wheel_count_options").notNull().default("1,2,3,4"), // Available options (comma-separated)
  diameterOptions: text("diameter_options").notNull().default("14,15,16,17,18,19,20,21,22"), // Available diameters (comma-separated)
  companyName: varchar("company_name", { length: 255 }).notNull().default("MyJantes"),
  companyAddress: text("company_address"),
  companyPhone: varchar("company_phone", { length: 50 }),
  companyEmail: varchar("company_email", { length: 255 }),
  companySiret: varchar("company_siret", { length: 14 }),
  companyTvaNumber: varchar("company_tva_number", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Engagements (Prestations) - groups quotes, invoices and reservations per client
export const engagements = pgTable("engagements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { enum: ["active", "completed", "cancelled"] }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  quotes: many(quotes),
  invoices: many(invoices),
  reservations: many(reservations),
  notifications: many(notifications),
  engagements: many(engagements),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  quotes: many(quotes),
  reservations: many(reservations),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  client: one(users, {
    fields: [quotes.clientId],
    references: [users.id],
  }),
  service: one(services, {
    fields: [quotes.serviceId],
    references: [services.id],
  }),
  invoices: many(invoices),
  reservations: many(reservations),
  items: many(quoteItems),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteItems.quoteId],
    references: [quotes.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  quote: one(quotes, {
    fields: [invoices.quoteId],
    references: [quotes.id],
  }),
  client: one(users, {
    fields: [invoices.clientId],
    references: [users.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  quote: one(quotes, {
    fields: [reservations.quoteId],
    references: [quotes.id],
  }),
  client: one(users, {
    fields: [reservations.clientId],
    references: [users.id],
  }),
  service: one(services, {
    fields: [reservations.serviceId],
    references: [services.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const engagementsRelations = relations(engagements, ({ one }) => ({
  client: one(users, {
    fields: [engagements.clientId],
    references: [users.id],
  }),
}));

export const quoteMediaRelations = relations(quoteMedia, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteMedia.quoteId],
    references: [quotes.id],
  }),
}));

export const invoiceMediaRelations = relations(invoiceMedia, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceMedia.invoiceId],
    references: [invoices.id],
  }),
}));

// Zod Schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true, updatedAt: true });

// Custom invoice schema with data transformations
export const insertInvoiceSchema = createInsertSchema(invoices)
  .omit({ id: true, createdAt: true, updatedAt: true, invoiceNumber: true })
  .extend({
    amount: z.union([z.string(), z.number()]).transform(val => String(val)),
    dueDate: z.union([z.date(), z.string()]).transform(val => 
      typeof val === 'string' ? new Date(val) : val
    ).optional(),
    quoteId: z.string().nullable().optional(), // Optional for direct invoices
    paymentMethod: z.enum(["cash", "wire_transfer", "card"]).default("wire_transfer"), // Required for direct invoices
    wheelCount: z.number().min(1).max(4).nullable().optional(),
    diameter: z.string().nullable().optional(),
    priceExcludingTax: z.string().nullable().optional(),
    taxRate: z.string().nullable().optional(),
    taxAmount: z.string().nullable().optional(),
    productDetails: z.string().nullable().optional(),
  });

// Custom reservation schema with data transformations
export const insertReservationSchema = createInsertSchema(reservations)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    scheduledDate: z.union([z.date(), z.string()]).transform(val => 
      typeof val === 'string' ? new Date(val) : val
    ),
    quoteId: z.string().nullable().optional(),
    wheelCount: z.number().min(1).max(4).nullable().optional(),
    diameter: z.string().nullable().optional(),
    priceExcludingTax: z.string().nullable().optional(),
    taxRate: z.string().nullable().optional(),
    taxAmount: z.string().nullable().optional(),
    productDetails: z.string().nullable().optional(),
  });

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuoteItemSchema = createInsertSchema(quoteItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertInvoiceCounterSchema = createInsertSchema(invoiceCounters).omit({ id: true, updatedAt: true });
export const insertQuoteMediaSchema = createInsertSchema(quoteMedia).omit({ id: true, createdAt: true });
export const insertInvoiceMediaSchema = createInsertSchema(invoiceMedia).omit({ id: true, createdAt: true });
export const insertApplicationSettingsSchema = createInsertSchema(applicationSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEngagementSchema = createInsertSchema(engagements).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservations.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertInvoiceCounter = z.infer<typeof insertInvoiceCounterSchema>;
export type InvoiceCounter = typeof invoiceCounters.$inferSelect;
export type InsertQuoteMedia = z.infer<typeof insertQuoteMediaSchema>;
export type QuoteMedia = typeof quoteMedia.$inferSelect;
export type InsertInvoiceMedia = z.infer<typeof insertInvoiceMediaSchema>;
export type InvoiceMedia = typeof invoiceMedia.$inferSelect;
export type InsertApplicationSettings = z.infer<typeof insertApplicationSettingsSchema>;
export type ApplicationSettings = typeof applicationSettings.$inferSelect;
export type InsertEngagement = z.infer<typeof insertEngagementSchema>;
export type Engagement = typeof engagements.$inferSelect;
