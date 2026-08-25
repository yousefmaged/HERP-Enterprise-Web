import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const organizationRoles = ["general_manager", "unit_manager", "employee"] as const;
export const moduleKeys = ["dashboard", "hr", "finance", "inventory", "crm", "reports", "settings"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  legalName: varchar("legalName", { length: 240 }),
  taxNumber: varchar("taxNumber", { length: 80 }),
  baseCurrency: varchar("baseCurrency", { length: 3 }).default("SAR").notNull(),
  fiscalYearStartMonth: int("fiscalYearStartMonth").default(1).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const organizationMembers = mysqlTable("organizationMembers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", organizationRoles).default("employee").notNull(),
  allowedModules: json("allowedModules").$type<string[]>().notNull(),
  branchScope: json("branchScope").$type<number[]>().notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("org_member_org_idx").on(table.organizationId),
  index("org_member_user_idx").on(table.userId),
]);

export const branches = mysqlTable("branches", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  city: varchar("city", { length: 120 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("branches_org_idx").on(table.organizationId)]);

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  branchId: int("branchId"),
  name: varchar("name", { length: 160 }).notNull(),
  managerEmployeeId: int("managerEmployeeId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("departments_org_idx").on(table.organizationId)]);

export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  branchId: int("branchId"),
  departmentId: int("departmentId"),
  userId: int("userId"),
  employeeCode: varchar("employeeCode", { length: 40 }).notNull(),
  fullName: varchar("fullName", { length: 180 }).notNull(),
  jobTitle: varchar("jobTitle", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 48 }),
  joinDate: timestamp("joinDate"),
  employmentStatus: mysqlEnum("employmentStatus", ["active", "on_leave", "inactive"]).default("active").notNull(),
  baseSalary: decimal("baseSalary", { precision: 14, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("employees_org_idx").on(table.organizationId),
  index("employees_department_idx").on(table.departmentId),
]);

export const attendanceRecords = mysqlTable("attendanceRecords", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  employeeId: int("employeeId").notNull(),
  workDate: timestamp("workDate").notNull(),
  checkInAt: timestamp("checkInAt"),
  checkOutAt: timestamp("checkOutAt"),
  status: mysqlEnum("status", ["present", "absent", "late", "remote"]).default("present").notNull(),
  notes: text("notes"),
}, (table) => [index("attendance_org_date_idx").on(table.organizationId, table.workDate)]);

export const leaveRequests = mysqlTable("leaveRequests", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  employeeId: int("employeeId").notNull(),
  leaveType: mysqlEnum("leaveType", ["annual", "sick", "unpaid", "other"]).default("annual").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  reason: text("reason"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedByUserId: int("reviewedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("leave_org_status_idx").on(table.organizationId, table.status)]);

export const payrollRuns = mysqlTable("payrollRuns", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  periodLabel: varchar("periodLabel", { length: 48 }).notNull(),
  totalGross: decimal("totalGross", { precision: 14, scale: 2 }).default("0.00").notNull(),
  totalNet: decimal("totalNet", { precision: 14, scale: 2 }).default("0.00").notNull(),
  status: mysqlEnum("status", ["draft", "review", "approved", "paid"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("payroll_org_idx").on(table.organizationId)]);

export const chartAccounts = mysqlTable("chartAccounts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  accountCode: varchar("accountCode", { length: 32 }).notNull(),
  accountName: varchar("accountName", { length: 180 }).notNull(),
  accountType: mysqlEnum("accountType", ["asset", "liability", "equity", "revenue", "expense"]).notNull(),
  parentAccountId: int("parentAccountId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("accounts_org_idx").on(table.organizationId)]);

export const journalEntries = mysqlTable("journalEntries", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  entryNumber: varchar("entryNumber", { length: 48 }).notNull(),
  entryDate: timestamp("entryDate").notNull(),
  description: text("description").notNull(),
  sourceModule: varchar("sourceModule", { length: 48 }),
  status: mysqlEnum("status", ["draft", "posted", "void"]).default("draft").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("journal_org_date_idx").on(table.organizationId, table.entryDate)]);

export const journalLines = mysqlTable("journalLines", {
  id: int("id").autoincrement().primaryKey(),
  journalEntryId: int("journalEntryId").notNull(),
  accountId: int("accountId").notNull(),
  debit: decimal("debit", { precision: 14, scale: 2 }).default("0.00").notNull(),
  credit: decimal("credit", { precision: 14, scale: 2 }).default("0.00").notNull(),
  memo: varchar("memo", { length: 240 }),
});

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  clientId: int("clientId"),
  invoiceNumber: varchar("invoiceNumber", { length: 48 }).notNull(),
  invoiceType: mysqlEnum("invoiceType", ["sales", "purchase"]).default("sales").notNull(),
  issueDate: timestamp("issueDate").notNull(),
  dueDate: timestamp("dueDate"),
  totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }).default("0.00").notNull(),
  paidAmount: decimal("paidAmount", { precision: 14, scale: 2 }).default("0.00").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "overdue", "paid", "void"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("invoice_org_status_idx").on(table.organizationId, table.status)]);

export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  branchId: int("branchId"),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("warehouse_org_idx").on(table.organizationId)]);

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  sku: varchar("sku", { length: 64 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  category: varchar("category", { length: 120 }),
  unit: varchar("unit", { length: 32 }).default("قطعة").notNull(),
  salePrice: decimal("salePrice", { precision: 14, scale: 2 }).default("0.00").notNull(),
  quantityOnHand: decimal("quantityOnHand", { precision: 14, scale: 3 }).default("0.000").notNull(),
  reorderLevel: decimal("reorderLevel", { precision: 14, scale: 3 }).default("0.000").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("products_org_idx").on(table.organizationId)]);

export const stockMovements = mysqlTable("stockMovements", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  productId: int("productId").notNull(),
  warehouseId: int("warehouseId"),
  movementType: mysqlEnum("movementType", ["in", "out", "adjustment"]).notNull(),
  quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(),
  reference: varchar("reference", { length: 96 }),
  notes: text("notes"),
  movedAt: timestamp("movedAt").defaultNow().notNull(),
  createdByUserId: int("createdByUserId").notNull(),
}, (table) => [index("stock_movement_org_idx").on(table.organizationId)]);

export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  companyName: varchar("companyName", { length: 180 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 48 }),
  status: mysqlEnum("status", ["lead", "active", "inactive"]).default("lead").notNull(),
  ownerUserId: int("ownerUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("clients_org_idx").on(table.organizationId)]);

export const salesOpportunities = mysqlTable("salesOpportunities", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  clientId: int("clientId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  estimatedValue: decimal("estimatedValue", { precision: 14, scale: 2 }).default("0.00").notNull(),
  stage: mysqlEnum("stage", ["qualification", "proposal", "negotiation", "won", "lost"]).default("qualification").notNull(),
  expectedCloseDate: timestamp("expectedCloseDate"),
  ownerUserId: int("ownerUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("opportunities_org_idx").on(table.organizationId)]);

export const crmFollowUps = mysqlTable("crmFollowUps", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  opportunityId: int("opportunityId"),
  clientId: int("clientId").notNull(),
  type: mysqlEnum("type", ["call", "meeting", "email", "note"]).default("note").notNull(),
  content: text("content").notNull(),
  dueAt: timestamp("dueAt"),
  completedAt: timestamp("completedAt"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("followups_org_idx").on(table.organizationId)]);

export const workTasks = mysqlTable("workTasks", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  moduleKey: mysqlEnum("moduleKey", moduleKeys).default("dashboard").notNull(),
  assignedToUserId: int("assignedToUserId"),
  dueAt: timestamp("dueAt"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "completed", "cancelled"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("tasks_org_status_idx").on(table.organizationId, table.status)]);

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId"),
  type: mysqlEnum("type", ["task", "invoice", "inventory", "leave", "system"]).notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  body: text("body"),
  moduleKey: mysqlEnum("moduleKey", moduleKeys).default("dashboard").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("notifications_org_read_idx").on(table.organizationId, table.isRead)]);

export const reportSchedules = mysqlTable("reportSchedules", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  frequency: mysqlEnum("frequency", ["daily", "weekly"]).notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  lastSentAt: timestamp("lastSentAt"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("report_schedule_task_uid_idx").on(table.scheduleCronTaskUid)]);

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  actorUserId: int("actorUserId"),
  moduleKey: mysqlEnum("moduleKey", moduleKeys).default("dashboard").notNull(),
  action: varchar("action", { length: 96 }).notNull(),
  entityType: varchar("entityType", { length: 96 }).notNull(),
  entityId: varchar("entityId", { length: 96 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("audit_org_created_idx").on(table.organizationId, table.createdAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
