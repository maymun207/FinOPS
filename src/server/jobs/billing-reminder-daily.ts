/**
 * billing-reminder-daily — Daily cron task for upcoming/overdue invoice reminders.
 *
 * Schedule: '0 5 * * *' (08:00 Istanbul = 05:00 UTC)
 *
 * Logic:
 *   1. Query invoices WHERE direction='outbound' (sales)
 *      AND status NOT IN ('PAID', 'CANCELLED')
 *      AND due_date BETWEEN today AND today+7
 *   2. For each found invoice, insert a notification row
 *   3. Return { reminders_sent: count }
 */
import { schedules, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/server/db";
import { invoices } from "@/server/db/schema/invoices";
import { and, eq, gte, lte, notInArray, sql } from "drizzle-orm";

export const billingReminderDaily = schedules.task({
  id: "billing-reminder-daily",
  cron: "0 5 * * *", // 08:00 Istanbul (UTC+3)
  run: async () => {
    logger.info("Starting daily billing reminder check");

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]!;

    // 7 days from now
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split("T")[0]!;

    // Find invoices due within the next 7 days that aren't paid or cancelled
    const upcomingInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        dueDate: invoices.dueDate,
        grandTotal: invoices.grandTotal,
        status: invoices.status,
        companyId: invoices.companyId,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.direction, "outbound"),
          notInArray(invoices.status, ["PAID", "CANCELLED"]),
          gte(invoices.dueDate, sql`${todayStr}::date`),
          lte(invoices.dueDate, sql`${nextWeekStr}::date`)
        )
      );

    logger.info(`Found ${upcomingInvoices.length} invoices due within 7 days`);

    // Also find overdue invoices (past due)
    const overdueInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        dueDate: invoices.dueDate,
        grandTotal: invoices.grandTotal,
        status: invoices.status,
        companyId: invoices.companyId,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.direction, "outbound"),
          notInArray(invoices.status, ["PAID", "CANCELLED"]),
          lte(invoices.dueDate, sql`${todayStr}::date`)
        )
      );

    logger.info(`Found ${overdueInvoices.length} overdue invoices`);

    // Combine and deduplicate
    const allInvoiceIds = new Set<string>();
    const reminderInvoices: typeof upcomingInvoices = [];

    for (const inv of [...overdueInvoices, ...upcomingInvoices]) {
      if (!allInvoiceIds.has(inv.id)) {
        allInvoiceIds.add(inv.id);
        reminderInvoices.push(inv);
      }
    }

    // For each invoice, log the reminder (notification system is Step 16)
    let remindersSent = 0;
    for (const inv of reminderInvoices) {
      const isOverdue = inv.dueDate && new Date(inv.dueDate) < today;
      const type = isOverdue ? "OVERDUE" : "UPCOMING";

      logger.info(`${type} reminder`, {
        invoiceNumber: inv.invoiceNumber,
        dueDate: inv.dueDate,
        grandTotal: inv.grandTotal,
        companyId: inv.companyId,
      });

      // TODO: Insert into notifications table (Step 16)
      // await db.insert(notifications).values({ ... });
      remindersSent++;
    }

    logger.info("Billing reminder check complete", { reminders_sent: remindersSent });
    return { reminders_sent: remindersSent };
  },
});
