import { describe, expect, it } from "vitest";
import { decimalNumber, hasModuleAccess, HERP_MODULES, herpRouter } from "./routers/herp";

describe("HERP router contract", () => {
  it("exposes the enterprise modules needed by the application shell", () => {
    expect(HERP_MODULES).toEqual(["dashboard", "hr", "finance", "inventory", "crm", "reports", "settings"]);
    expect(Object.keys(herpRouter._def.record)).toEqual(expect.arrayContaining([
      "bootstrap", "context", "dashboard", "people", "finance", "inventory", "crm", "tasks", "notifications", "reports", "members", "ai",
    ]));
  });

  it("normalizes database decimal values before they reach dashboard and report views", () => {
    expect(decimalNumber("1280.50")).toBe(1280.5);
    expect(decimalNumber(null)).toBe(0);
    expect(decimalNumber(undefined)).toBe(0);
  });

  it("exposes operational procedures for payroll, accounting entries, and financial statements", () => {
    const procedures = Object.keys(herpRouter._def.procedures);
    expect(procedures).toEqual(expect.arrayContaining([
      "people.attendance", "people.recordAttendance", "people.payrolls", "people.createPayroll",
      "finance.journals", "finance.createJournal", "finance.trialBalance", "finance.incomeStatement",
    ]));
  });

  it("enforces module-level access and write permissions for HERP roles", () => {
    expect(hasModuleAccess("user", "employee", ["hr"], "hr")).toBe(true);
    expect(hasModuleAccess("user", "employee", ["hr"], "finance")).toBe(false);
    expect(hasModuleAccess("user", "employee", ["hr"], "hr", true)).toBe(false);
    expect(hasModuleAccess("user", "unit_manager", ["hr"], "hr", true)).toBe(true);
    expect(hasModuleAccess("admin", "employee", [], "finance", true)).toBe(true);
  });
});
