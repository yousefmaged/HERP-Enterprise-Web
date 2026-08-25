import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  attendanceRecords,
  auditLogs,
  chartAccounts,
  clients,
  crmFollowUps,
  employees,
  invoices,
  journalEntries,
  journalLines,
  leaveRequests,
  notifications,
  organizationMembers,
  organizations,
  payrollRuns,
  products,
  reportSchedules,
  salesOpportunities,
  stockMovements,
  users,
  workTasks,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";

export const HERP_MODULES = ["dashboard", "hr", "finance", "inventory", "crm", "reports", "settings"] as const;
const moduleSchema = z.enum(HERP_MODULES);
const organizationRoleSchema = z.enum(["general_manager", "unit_manager", "employee"]);

type ModuleKey = (typeof HERP_MODULES)[number];
type Workspace = {
  organizationId: number;
  organizationName: string;
  baseCurrency: string;
  memberRole: "general_manager" | "unit_manager" | "employee";
  allowedModules: string[];
};

export const decimalNumber = (value: unknown) => Number(value ?? 0);

export function hasModuleAccess(
  globalRole: "user" | "admin",
  memberRole: Workspace["memberRole"],
  allowedModules: string[],
  moduleKey: ModuleKey,
  write = false,
) {
  const isGlobalAdmin = globalRole === "admin";
  const isManager = memberRole === "general_manager" || memberRole === "unit_manager";
  const hasModule = isGlobalAdmin || memberRole === "general_manager" || allowedModules.includes(moduleKey);
  return hasModule && (!write || isGlobalAdmin || isManager);
}

async function getWorkspace(userId: number): Promise<{ db: NonNullable<Awaited<ReturnType<typeof getDb>>>; workspace: Workspace }> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة بيانات HERP غير متاحة حاليًا." });
  const rows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      baseCurrency: organizations.baseCurrency,
      memberRole: organizationMembers.role,
      allowedModules: organizationMembers.allowedModules,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isActive, true)))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "لم تُهيّأ مؤسستك بعد." });
  return { db, workspace: rows[0] };
}

async function authorize(userId: number, globalRole: "user" | "admin", moduleKey: ModuleKey, write = false) {
  const { db, workspace } = await getWorkspace(userId);
  if (!hasModuleAccess(globalRole, workspace.memberRole, workspace.allowedModules, moduleKey, write)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك الصلاحية اللازمة لهذه العملية." });
  }
  return { db, workspace };
}

async function addAudit(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  organizationId: number,
  actorUserId: number,
  moduleKey: ModuleKey,
  action: string,
  entityType: string,
  entityId?: string,
) {
  await db.insert(auditLogs).values({ organizationId, actorUserId, moduleKey, action, entityType, entityId });
}

function rangeStart(period?: "7d" | "30d" | "year") {
  if (!period) return undefined;
  const start = new Date();
  if (period === "7d") start.setUTCDate(start.getUTCDate() - 7);
  if (period === "30d") start.setUTCDate(start.getUTCDate() - 30);
  if (period === "year") start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start;
}

async function dashboardData(userId: number, globalRole: "user" | "admin", period?: "7d" | "30d" | "year") {
  const { db, workspace } = await authorize(userId, globalRole, "dashboard");
  const org = workspace.organizationId;
  const startDate = rangeStart(period);
  const [sales, employeeCount, inventory, clientCount, overdue, lowStock, pendingLeaves, tasks, recentInvoices, salesTrend] = await Promise.all([
    db.select({ value: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)` }).from(invoices).where(and(eq(invoices.organizationId, org), eq(invoices.invoiceType, "sales"), ne(invoices.status, "void"), startDate ? gte(invoices.issueDate, startDate) : undefined)),
    db.select({ value: sql<number>`COUNT(*)` }).from(employees).where(and(eq(employees.organizationId, org), eq(employees.employmentStatus, "active"))),
    db.select({ value: sql<string>`COALESCE(SUM(${products.quantityOnHand} * ${products.salePrice}), 0)` }).from(products).where(eq(products.organizationId, org)),
    db.select({ value: sql<number>`COUNT(*)` }).from(clients).where(and(eq(clients.organizationId, org), eq(clients.status, "active"))),
    db.select({ value: sql<number>`COUNT(*)` }).from(invoices).where(and(eq(invoices.organizationId, org), inArray(invoices.status, ["overdue", "sent"]))),
    db.select({ value: sql<number>`COUNT(*)` }).from(products).where(and(eq(products.organizationId, org), lte(products.quantityOnHand, products.reorderLevel))),
    db.select({ value: sql<number>`COUNT(*)` }).from(leaveRequests).where(and(eq(leaveRequests.organizationId, org), eq(leaveRequests.status, "pending"))),
    db.select().from(workTasks).where(and(eq(workTasks.organizationId, org), inArray(workTasks.status, ["open", "in_progress"]))).orderBy(desc(workTasks.createdAt)).limit(6),
    db.select().from(invoices).where(and(eq(invoices.organizationId, org), startDate ? gte(invoices.issueDate, startDate) : undefined)).orderBy(desc(invoices.createdAt)).limit(5),
    db.select({ period: sql<string>`DATE_FORMAT(${invoices.issueDate}, '%Y-%m')`, value: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)` }).from(invoices).where(and(eq(invoices.organizationId, org), eq(invoices.invoiceType, "sales"), ne(invoices.status, "void"), startDate ? gte(invoices.issueDate, startDate) : undefined)).groupBy(sql`DATE_FORMAT(${invoices.issueDate}, '%Y-%m')`).orderBy(sql`DATE_FORMAT(${invoices.issueDate}, '%Y-%m')`).limit(12),
  ]);
  const alerts = [
    overdue[0]?.value ? { type: "invoice", title: "فواتير قيد المتابعة", count: overdue[0].value, moduleKey: "finance" as const } : null,
    lowStock[0]?.value ? { type: "inventory", title: "أصناف وصلت للحد الأدنى", count: lowStock[0].value, moduleKey: "inventory" as const } : null,
    pendingLeaves[0]?.value ? { type: "leave", title: "طلبات إجازة بانتظار المراجعة", count: pendingLeaves[0].value, moduleKey: "hr" as const } : null,
  ].filter(Boolean);
  return {
    workspace,
    kpis: {
      sales: decimalNumber(sales[0]?.value),
      employees: Number(employeeCount[0]?.value ?? 0),
      inventoryValue: decimalNumber(inventory[0]?.value),
      activeClients: Number(clientCount[0]?.value ?? 0),
    },
    alerts,
    tasks,
    recentInvoices: recentInvoices.map((invoice) => ({ ...invoice, totalAmount: decimalNumber(invoice.totalAmount), paidAmount: decimalNumber(invoice.paidAmount) })),
    salesTrend: salesTrend.map((item) => ({ period: item.period, value: decimalNumber(item.value) })),
  };
}

const now = () => new Date();

export const herpRouter = router({
  bootstrap: protectedProcedure
    .input(z.object({ name: z.string().min(2).max(180), currency: z.string().length(3).default("SAR") }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة." });
      const existing = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, ctx.user.id)).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "تم إعداد مؤسسة لهذا المستخدم بالفعل." });
      const result = await db.insert(organizations).values({ name: input.name, baseCurrency: input.currency.toUpperCase(), createdByUserId: ctx.user.id });
      const organizationId = Number(result[0].insertId);
      await db.insert(organizationMembers).values({ organizationId, userId: ctx.user.id, role: "general_manager", allowedModules: [...HERP_MODULES], branchScope: [] });
      await db.insert(chartAccounts).values([
        { organizationId, accountCode: "1000", accountName: "النقدية والبنوك", accountType: "asset" },
        { organizationId, accountCode: "1100", accountName: "الذمم المدينة", accountType: "asset" },
        { organizationId, accountCode: "2000", accountName: "الذمم الدائنة", accountType: "liability" },
        { organizationId, accountCode: "4000", accountName: "إيرادات المبيعات", accountType: "revenue" },
        { organizationId, accountCode: "5000", accountName: "مصروفات التشغيل", accountType: "expense" },
      ]);
      await addAudit(db, organizationId, ctx.user.id, "settings", "organization.bootstrap", "organization", String(organizationId));
      return { organizationId };
    }),
  context: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { workspace } = await getWorkspace(ctx.user.id);
      return { initialized: true, workspace };
    } catch (error) {
      if (error instanceof TRPCError && error.code === "NOT_FOUND") return { initialized: false, workspace: null };
      throw error;
    }
  }),
  dashboard: protectedProcedure.query(({ ctx }) => dashboardData(ctx.user.id, ctx.user.role)),
  people: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "hr");
      const rows = await db.select().from(employees).where(eq(employees.organizationId, workspace.organizationId)).orderBy(desc(employees.createdAt));
      return rows.map((row) => ({ ...row, baseSalary: decimalNumber(row.baseSalary) }));
    }),
    create: protectedProcedure.input(z.object({ fullName: z.string().min(2), jobTitle: z.string().min(2), email: z.string().email().optional().or(z.literal("")), phone: z.string().max(48).optional(), employeeCode: z.string().min(2), baseSalary: z.number().min(0).default(0) })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "hr", true);
      const result = await db.insert(employees).values({ organizationId: workspace.organizationId, fullName: input.fullName, jobTitle: input.jobTitle, email: input.email || null, phone: input.phone || null, employeeCode: input.employeeCode, baseSalary: String(input.baseSalary), joinDate: now() });
      await addAudit(db, workspace.organizationId, ctx.user.id, "hr", "employee.create", "employee", String(result[0].insertId));
      return { id: Number(result[0].insertId) };
    }),
    leaves: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "hr");
      return db.select({ id: leaveRequests.id, status: leaveRequests.status, leaveType: leaveRequests.leaveType, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, reason: leaveRequests.reason, fullName: employees.fullName }).from(leaveRequests).innerJoin(employees, eq(leaveRequests.employeeId, employees.id)).where(eq(leaveRequests.organizationId, workspace.organizationId)).orderBy(desc(leaveRequests.createdAt));
    }),
    createLeave: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), leaveType: z.enum(["annual", "sick", "unpaid", "other"]), startDate: z.coerce.date(), endDate: z.coerce.date(), reason: z.string().max(600).optional() })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "hr");
      const result = await db.insert(leaveRequests).values({ organizationId: workspace.organizationId, ...input, reason: input.reason || null });
      await db.insert(notifications).values({ organizationId: workspace.organizationId, type: "leave", title: "طلب إجازة جديد", body: "طلب جديد بانتظار المراجعة.", moduleKey: "hr" });
      return { id: Number(result[0].insertId) };
    }),
    reviewLeave: protectedProcedure.input(z.object({ id: z.number().int(), status: z.enum(["approved", "rejected"]) })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "hr", true);
      await db.update(leaveRequests).set({ status: input.status, reviewedByUserId: ctx.user.id }).where(and(eq(leaveRequests.id, input.id), eq(leaveRequests.organizationId, workspace.organizationId)));
      return { ok: true };
    }),
    attendance: protectedProcedure.input(z.object({ workDate: z.coerce.date().optional() }).optional()).query(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "hr");
      return db.select({ id: attendanceRecords.id, workDate: attendanceRecords.workDate, status: attendanceRecords.status, checkInAt: attendanceRecords.checkInAt, checkOutAt: attendanceRecords.checkOutAt, fullName: employees.fullName, employeeCode: employees.employeeCode }).from(attendanceRecords).innerJoin(employees, eq(attendanceRecords.employeeId, employees.id)).where(and(eq(attendanceRecords.organizationId, workspace.organizationId), input?.workDate ? eq(attendanceRecords.workDate, input.workDate) : undefined)).orderBy(desc(attendanceRecords.workDate)).limit(80);
    }),
    recordAttendance: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), workDate: z.coerce.date(), status: z.enum(["present", "absent", "late", "remote"]), checkInAt: z.coerce.date().optional(), checkOutAt: z.coerce.date().optional(), notes: z.string().max(500).optional() })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "hr", true);
      const employee = (await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.organizationId, workspace.organizationId))).limit(1))[0];
      if (!employee) throw new TRPCError({ code: "NOT_FOUND", message: "الموظف غير موجود ضمن المؤسسة." });
      await db.insert(attendanceRecords).values({ organizationId: workspace.organizationId, employeeId: input.employeeId, workDate: input.workDate, status: input.status, checkInAt: input.checkInAt ?? null, checkOutAt: input.checkOutAt ?? null, notes: input.notes ?? null });
      return { ok: true };
    }),
    payrolls: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "hr");
      const rows = await db.select().from(payrollRuns).where(eq(payrollRuns.organizationId, workspace.organizationId)).orderBy(desc(payrollRuns.createdAt));
      return rows.map((row) => ({ ...row, totalGross: decimalNumber(row.totalGross), totalNet: decimalNumber(row.totalNet) }));
    }),
    createPayroll: protectedProcedure.input(z.object({ periodLabel: z.string().min(3).max(48) })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "hr", true);
      const total = (await db.select({ value: sql<string>`COALESCE(SUM(${employees.baseSalary}), 0)` }).from(employees).where(and(eq(employees.organizationId, workspace.organizationId), eq(employees.employmentStatus, "active"))))[0]?.value ?? "0";
      const result = await db.insert(payrollRuns).values({ organizationId: workspace.organizationId, periodLabel: input.periodLabel, totalGross: total, totalNet: total, status: "draft" });
      await addAudit(db, workspace.organizationId, ctx.user.id, "hr", "payroll.create", "payroll", String(result[0].insertId));
      return { id: Number(result[0].insertId), total: decimalNumber(total) };
    }),
  }),
  finance: router({
    accounts: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "finance");
      return db.select().from(chartAccounts).where(eq(chartAccounts.organizationId, workspace.organizationId)).orderBy(chartAccounts.accountCode);
    }),
    createAccount: protectedProcedure.input(z.object({ accountCode: z.string().min(2), accountName: z.string().min(2), accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]) })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "finance", true);
      const result = await db.insert(chartAccounts).values({ organizationId: workspace.organizationId, ...input });
      return { id: Number(result[0].insertId) };
    }),
    invoices: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "finance");
      const rows = await db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, invoiceType: invoices.invoiceType, issueDate: invoices.issueDate, dueDate: invoices.dueDate, totalAmount: invoices.totalAmount, paidAmount: invoices.paidAmount, status: invoices.status, clientName: clients.name }).from(invoices).leftJoin(clients, eq(invoices.clientId, clients.id)).where(eq(invoices.organizationId, workspace.organizationId)).orderBy(desc(invoices.issueDate));
      return rows.map((row) => ({ ...row, totalAmount: decimalNumber(row.totalAmount), paidAmount: decimalNumber(row.paidAmount) }));
    }),
    createInvoice: protectedProcedure.input(z.object({ invoiceNumber: z.string().min(2), invoiceType: z.enum(["sales", "purchase"]), clientId: z.number().int().positive().optional(), totalAmount: z.number().min(0), dueDate: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "finance", true);
      const result = await db.insert(invoices).values({ organizationId: workspace.organizationId, invoiceNumber: input.invoiceNumber, invoiceType: input.invoiceType, clientId: input.clientId ?? null, totalAmount: String(input.totalAmount), issueDate: now(), dueDate: input.dueDate ?? null, status: "sent" });
      await addAudit(db, workspace.organizationId, ctx.user.id, "finance", "invoice.create", "invoice", String(result[0].insertId));
      return { id: Number(result[0].insertId) };
    }),
    journals: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "finance");
      return db.select().from(journalEntries).where(eq(journalEntries.organizationId, workspace.organizationId)).orderBy(desc(journalEntries.entryDate)).limit(50);
    }),
    createJournal: protectedProcedure.input(z.object({ entryNumber: z.string().min(2).max(48), entryDate: z.coerce.date(), description: z.string().min(3).max(800), lines: z.array(z.object({ accountId: z.number().int().positive(), debit: z.number().min(0), credit: z.number().min(0), memo: z.string().max(240).optional() })).min(2) }).superRefine((value, ctx) => {
      const debit = value.lines.reduce((sum, line) => sum + line.debit, 0);
      const credit = value.lines.reduce((sum, line) => sum + line.credit, 0);
      if (Math.abs(debit - credit) > 0.005) ctx.addIssue({ code: "custom", message: "يجب أن يتساوى إجمالي المدين مع إجمالي الدائن.", path: ["lines"] });
      if (!value.lines.some((line) => line.debit > 0) || !value.lines.some((line) => line.credit > 0)) ctx.addIssue({ code: "custom", message: "يجب أن يحتوي القيد على طرف مدين وطرف دائن.", path: ["lines"] });
    })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "finance", true);
      const accountIds = Array.from(new Set(input.lines.map((line) => line.accountId)));
      const accounts = await db.select({ id: chartAccounts.id }).from(chartAccounts).where(and(eq(chartAccounts.organizationId, workspace.organizationId), inArray(chartAccounts.id, accountIds)));
      if (accounts.length !== accountIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "يتضمن القيد حسابًا غير تابع للمؤسسة." });
      const result = await db.insert(journalEntries).values({ organizationId: workspace.organizationId, entryNumber: input.entryNumber, entryDate: input.entryDate, description: input.description, sourceModule: "finance", status: "posted", createdByUserId: ctx.user.id });
      const journalEntryId = Number(result[0].insertId);
      await db.insert(journalLines).values(input.lines.map((line) => ({ journalEntryId, accountId: line.accountId, debit: String(line.debit), credit: String(line.credit), memo: line.memo ?? null })));
      await addAudit(db, workspace.organizationId, ctx.user.id, "finance", "journal.post", "journal", String(journalEntryId));
      return { id: journalEntryId };
    }),
    trialBalance: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "finance");
      const rows = await db.select({ id: chartAccounts.id, accountCode: chartAccounts.accountCode, accountName: chartAccounts.accountName, accountType: chartAccounts.accountType, debit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`, credit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)` }).from(chartAccounts).leftJoin(journalLines, eq(chartAccounts.id, journalLines.accountId)).leftJoin(journalEntries, and(eq(journalLines.journalEntryId, journalEntries.id), eq(journalEntries.status, "posted"))).where(eq(chartAccounts.organizationId, workspace.organizationId)).groupBy(chartAccounts.id, chartAccounts.accountCode, chartAccounts.accountName, chartAccounts.accountType).orderBy(chartAccounts.accountCode);
      return rows.map((row) => ({ ...row, debit: decimalNumber(row.debit), credit: decimalNumber(row.credit) }));
    }),
    incomeStatement: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "finance");
      const rows = await db.select({ accountType: chartAccounts.accountType, debit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`, credit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)` }).from(chartAccounts).leftJoin(journalLines, eq(chartAccounts.id, journalLines.accountId)).leftJoin(journalEntries, and(eq(journalLines.journalEntryId, journalEntries.id), eq(journalEntries.status, "posted"))).where(eq(chartAccounts.organizationId, workspace.organizationId)).groupBy(chartAccounts.accountType);
      const values = rows.map((row) => ({ type: row.accountType, debit: decimalNumber(row.debit), credit: decimalNumber(row.credit) }));
      const revenue = values.filter((row) => row.type === "revenue").reduce((sum, row) => sum + row.credit - row.debit, 0);
      const expenses = values.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.debit - row.credit, 0);
      return { revenue, expenses, netIncome: revenue - expenses };
    }),
  }),
  inventory: router({
    products: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "inventory");
      const rows = await db.select().from(products).where(eq(products.organizationId, workspace.organizationId)).orderBy(desc(products.createdAt));
      return rows.map((row) => ({ ...row, salePrice: decimalNumber(row.salePrice), quantityOnHand: decimalNumber(row.quantityOnHand), reorderLevel: decimalNumber(row.reorderLevel) }));
    }),
    createProduct: protectedProcedure.input(z.object({ sku: z.string().min(2), name: z.string().min(2), category: z.string().max(120).optional(), unit: z.string().min(1).max(32).default("قطعة"), salePrice: z.number().min(0), quantityOnHand: z.number().min(0), reorderLevel: z.number().min(0) })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "inventory", true);
      const result = await db.insert(products).values({ organizationId: workspace.organizationId, sku: input.sku, name: input.name, category: input.category || null, unit: input.unit, salePrice: String(input.salePrice), quantityOnHand: String(input.quantityOnHand), reorderLevel: String(input.reorderLevel) });
      return { id: Number(result[0].insertId) };
    }),
    moveStock: protectedProcedure.input(z.object({ productId: z.number().int().positive(), movementType: z.enum(["in", "out", "adjustment"]), quantity: z.number().positive(), reference: z.string().max(96).optional() })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "inventory", true);
      const product = (await db.select().from(products).where(and(eq(products.id, input.productId), eq(products.organizationId, workspace.organizationId))).limit(1))[0];
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود." });
      const current = decimalNumber(product.quantityOnHand);
      const next = input.movementType === "in" ? current + input.quantity : input.movementType === "out" ? current - input.quantity : input.quantity;
      if (next < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إخراج كمية تتجاوز الرصيد المتاح." });
      await db.insert(stockMovements).values({ organizationId: workspace.organizationId, productId: input.productId, movementType: input.movementType, quantity: String(input.quantity), reference: input.reference || null, createdByUserId: ctx.user.id });
      await db.update(products).set({ quantityOnHand: String(next) }).where(eq(products.id, input.productId));
      if (next <= decimalNumber(product.reorderLevel)) await db.insert(notifications).values({ organizationId: workspace.organizationId, type: "inventory", title: `تنبيه مخزون: ${product.name}`, body: "وصل رصيد الصنف إلى حد إعادة الطلب أو دونه.", moduleKey: "inventory" });
      return { quantityOnHand: next };
    }),
  }),
  crm: router({
    clients: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "crm");
      return db.select().from(clients).where(eq(clients.organizationId, workspace.organizationId)).orderBy(desc(clients.createdAt));
    }),
    createClient: protectedProcedure.input(z.object({ name: z.string().min(2), companyName: z.string().max(180).optional(), email: z.string().email().optional().or(z.literal("")), phone: z.string().max(48).optional(), status: z.enum(["lead", "active", "inactive"]).default("lead") })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "crm", true);
      const result = await db.insert(clients).values({ organizationId: workspace.organizationId, name: input.name, companyName: input.companyName || null, email: input.email || null, phone: input.phone || null, status: input.status, ownerUserId: ctx.user.id });
      return { id: Number(result[0].insertId) };
    }),
    opportunities: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "crm");
      const rows = await db.select({ id: salesOpportunities.id, title: salesOpportunities.title, stage: salesOpportunities.stage, estimatedValue: salesOpportunities.estimatedValue, expectedCloseDate: salesOpportunities.expectedCloseDate, clientName: clients.name }).from(salesOpportunities).innerJoin(clients, eq(salesOpportunities.clientId, clients.id)).where(eq(salesOpportunities.organizationId, workspace.organizationId)).orderBy(desc(salesOpportunities.createdAt));
      return rows.map((row) => ({ ...row, estimatedValue: decimalNumber(row.estimatedValue) }));
    }),
    createOpportunity: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), title: z.string().min(2), estimatedValue: z.number().min(0), stage: z.enum(["qualification", "proposal", "negotiation", "won", "lost"]).default("qualification"), expectedCloseDate: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "crm", true);
      const result = await db.insert(salesOpportunities).values({ organizationId: workspace.organizationId, ...input, estimatedValue: String(input.estimatedValue), ownerUserId: ctx.user.id, expectedCloseDate: input.expectedCloseDate ?? null });
      return { id: Number(result[0].insertId) };
    }),
    followUps: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "crm");
      return db.select({ id: crmFollowUps.id, content: crmFollowUps.content, type: crmFollowUps.type, dueAt: crmFollowUps.dueAt, completedAt: crmFollowUps.completedAt, clientName: clients.name }).from(crmFollowUps).innerJoin(clients, eq(crmFollowUps.clientId, clients.id)).where(eq(crmFollowUps.organizationId, workspace.organizationId)).orderBy(desc(crmFollowUps.createdAt));
    }),
    createFollowUp: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), opportunityId: z.number().int().positive().optional(), type: z.enum(["call", "meeting", "email", "note"]).default("note"), content: z.string().min(2).max(2000), dueAt: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "crm", true);
      const result = await db.insert(crmFollowUps).values({ organizationId: workspace.organizationId, clientId: input.clientId, opportunityId: input.opportunityId ?? null, type: input.type, content: input.content, dueAt: input.dueAt ?? null, createdByUserId: ctx.user.id });
      if (input.dueAt) await db.insert(notifications).values({ organizationId: workspace.organizationId, type: "task", title: "متابعة عميل مجدولة", body: input.content, moduleKey: "crm" });
      return { id: Number(result[0].insertId) };
    }),
  }),
  tasks: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "dashboard");
      return db.select().from(workTasks).where(eq(workTasks.organizationId, workspace.organizationId)).orderBy(desc(workTasks.createdAt));
    }),
    create: protectedProcedure.input(z.object({ title: z.string().min(2), moduleKey: moduleSchema.default("dashboard"), priority: z.enum(["low", "medium", "high", "critical"]).default("medium"), dueAt: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "dashboard", true);
      const result = await db.insert(workTasks).values({ organizationId: workspace.organizationId, title: input.title, moduleKey: input.moduleKey, priority: input.priority, dueAt: input.dueAt ?? null, assignedToUserId: ctx.user.id });
      return { id: Number(result[0].insertId) };
    }),
    updateStatus: protectedProcedure.input(z.object({ id: z.number().int(), status: z.enum(["open", "in_progress", "completed", "cancelled"]) })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "dashboard");
      await db.update(workTasks).set({ status: input.status }).where(and(eq(workTasks.id, input.id), eq(workTasks.organizationId, workspace.organizationId)));
      return { ok: true };
    }),
  }),
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "dashboard");
      return db.select().from(notifications).where(eq(notifications.organizationId, workspace.organizationId)).orderBy(desc(notifications.createdAt)).limit(20);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "dashboard");
      await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, input.id), eq(notifications.organizationId, workspace.organizationId)));
      return { ok: true };
    }),
  }),
  reports: router({
    summary: protectedProcedure.input(z.object({ period: z.enum(["7d", "30d", "year"]).optional() }).optional()).query(async ({ ctx, input }) => dashboardData(ctx.user.id, ctx.user.role, input?.period)),
    schedules: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "reports", true);
      return db.select().from(reportSchedules).where(eq(reportSchedules.organizationId, workspace.organizationId)).orderBy(desc(reportSchedules.createdAt));
    }),
    createSchedule: protectedProcedure.input(z.object({ name: z.string().min(2), frequency: z.enum(["daily", "weekly"]) })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "reports", true);
      const result = await db.insert(reportSchedules).values({ organizationId: workspace.organizationId, name: input.name, frequency: input.frequency, isActive: false, createdByUserId: ctx.user.id });
      return { id: Number(result[0].insertId), activationRequired: true };
    }),
    exportCsv: protectedProcedure.input(z.object({ moduleKey: z.enum(["finance", "inventory", "crm", "hr"]) })).query(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "reports");
      const org = workspace.organizationId;
      if (input.moduleKey === "inventory") {
        const rows = await db.select({ sku: products.sku, name: products.name, quantity: products.quantityOnHand, reorder: products.reorderLevel, price: products.salePrice }).from(products).where(eq(products.organizationId, org));
        return { filename: "herp-inventory.csv", content: ["SKU,الاسم,الرصيد,حد_إعادة_الطلب,سعر_البيع", ...rows.map((r) => `${r.sku},${r.name},${r.quantity},${r.reorder},${r.price}`)].join("\n") };
      }
      if (input.moduleKey === "crm") {
        const rows = await db.select().from(clients).where(eq(clients.organizationId, org));
        return { filename: "herp-clients.csv", content: ["الاسم,الشركة,البريد,الهاتف,الحالة", ...rows.map((r) => `${r.name},${r.companyName ?? ""},${r.email ?? ""},${r.phone ?? ""},${r.status}`)].join("\n") };
      }
      if (input.moduleKey === "hr") {
        const rows = await db.select().from(employees).where(eq(employees.organizationId, org));
        return { filename: "herp-employees.csv", content: ["الكود,الاسم,المسمى,البريد,الحالة", ...rows.map((r) => `${r.employeeCode},${r.fullName},${r.jobTitle},${r.email ?? ""},${r.employmentStatus}`)].join("\n") };
      }
      const rows = await db.select().from(invoices).where(eq(invoices.organizationId, org));
      return { filename: "herp-invoices.csv", content: ["الرقم,النوع,التاريخ,الإجمالي,المدفوع,الحالة", ...rows.map((r) => `${r.invoiceNumber},${r.invoiceType},${r.issueDate.toISOString()},${r.totalAmount},${r.paidAmount},${r.status}`)].join("\n") };
    }),
  }),
  ai: router({
    ask: protectedProcedure.input(z.object({ question: z.string().min(3).max(1200) })).mutation(async ({ ctx, input }) => {
      const summary = await dashboardData(ctx.user.id, ctx.user.role);
      const context = `المؤسسة: ${summary.workspace.organizationName}. العملة: ${summary.workspace.baseCurrency}. مؤشرات موثقة الآن: إجمالي فواتير المبيعات ${summary.kpis.sales}، الموظفون النشطون ${summary.kpis.employees}، قيمة المخزون ${summary.kpis.inventoryValue}، العملاء النشطون ${summary.kpis.activeClients}. التنبيهات: ${summary.alerts.map((a) => `${a?.title}: ${a?.count}`).join("؛ ") || "لا توجد تنبيهات حرجة"}.`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `أنت مساعد HERP التنفيذي. أجب بالعربية فقط وباختصار مهني. اعتمد حصريًا على بيانات السياق أدناه، ولا تخترع أرقامًا أو حقائق. إذا لم تتوفر إجابة فاذكر ذلك بوضوح. ${context}` },
          { role: "user", content: input.question },
        ],
      });
      return { answer: response.choices[0]?.message?.content || "تعذر إنشاء إجابة الآن. حاول مجددًا." };
    }),
  }),
  members: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "settings", true);
      return db.select({ id: organizationMembers.id, role: organizationMembers.role, allowedModules: organizationMembers.allowedModules, isActive: organizationMembers.isActive, userId: users.id, name: users.name, email: users.email }).from(organizationMembers).innerJoin(users, eq(organizationMembers.userId, users.id)).where(eq(organizationMembers.organizationId, workspace.organizationId));
    }),
    add: protectedProcedure.input(z.object({ userOpenId: z.string().min(3), role: organizationRoleSchema, allowedModules: z.array(moduleSchema).min(1) })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "settings", true);
      if (workspace.memberRole !== "general_manager" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "إضافة أعضاء المؤسسة مخصصة للمدير العام." });
      const account = (await db.select().from(users).where(eq(users.openId, input.userOpenId)).limit(1))[0];
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "لا يوجد حساب بهذا المعرّف. يجب أن يسجل العضو دخوله إلى HERP أولًا." });
      const exists = await db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, workspace.organizationId), eq(organizationMembers.userId, account.id))).limit(1);
      if (exists[0]) throw new TRPCError({ code: "CONFLICT", message: "هذا العضو ضمن المؤسسة بالفعل." });
      const result = await db.insert(organizationMembers).values({ organizationId: workspace.organizationId, userId: account.id, role: input.role, allowedModules: input.allowedModules, branchScope: [] });
      await addAudit(db, workspace.organizationId, ctx.user.id, "settings", "member.add", "member", String(result[0].insertId));
      return { id: Number(result[0].insertId) };
    }),
    setRole: protectedProcedure.input(z.object({ memberId: z.number().int(), role: organizationRoleSchema, allowedModules: z.array(moduleSchema) })).mutation(async ({ ctx, input }) => {
      const { db, workspace } = await authorize(ctx.user.id, ctx.user.role, "settings", true);
      if (workspace.memberRole !== "general_manager" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "تعديل أدوار المؤسسة مخصص للمدير العام." });
      await db.update(organizationMembers).set({ role: input.role, allowedModules: input.allowedModules }).where(and(eq(organizationMembers.id, input.memberId), eq(organizationMembers.organizationId, workspace.organizationId)));
      return { ok: true };
    }),
  }),
});
