/**
 * billing-reminder-daily — Daily cron task for upcoming/overdue invoice reminders.
 *
 * Schedule: '0 5 * * *' (08:00 Istanbul = 05:00 UTC)
 * Istanbul is UTC+3 year-round (no DST), so '0 5 * * *' reliably fires at 08:00.
 *
 * Logic:
 *   1. Query outbound invoices NOT PAID/CANCELLED due within 7 days or overdue
 *   2. Join contact to get email
 *   3. For contacts without email → log warning, continue (never throw)
 *   4. For each valid contact, send reminder or log
 *   5. Return { reminders_sent, skipped_no_email }
 */
import { schedules, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/server/db";
import { invoices } from "@/server/db/schema/invoices";
import { contacts } from "@/server/db/schema/contacts";
import { and, eq, gte, lte, notInArray, sql } from "drizzle-orm";

export const billingReminderDaily = schedules.task({
  id: "billing-reminder-daily",
  cron: "0 5 * * *", // 08:00 Istanbul (UTC+3, no DST)
  run: async () => {
    logger.info("Starting daily billing reminder check");

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]!;

    // 7 days from now
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split("T")[0]!;

    // Find invoices due within the next 7 days that aren't paid or cancelled
    // Join with contacts to get email
    const upcomingInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        dueDate: invoices.dueDate,
        grandTotal: invoices.grandTotal,
        status: invoices.status,
        companyId: invoices.companyId,
        contactName: contacts.name,
        contactEmail: contacts.email,
      })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
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
        contactName: contacts.name,
        contactEmail: contacts.email,
      })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
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

    // Process each invoice — never throw on individual failures
    let remindersSent = 0;
    let skippedNoEmail = 0;

    for (const inv of reminderInvoices) {
      try {
        const isOverdue = inv.dueDate && new Date(inv.dueDate) < today;
        const type = isOverdue ? "OVERDUE" : "UPCOMING";

        // Check if contact has email
        if (!inv.contactEmail) {
          logger.warn(`${type} reminder skipped — contact has no email`, {
            invoiceNumber: inv.invoiceNumber,
            contactName: inv.contactName ?? "unknown",
            companyId: inv.companyId,
          });
          skippedNoEmail++;
          continue;
        }

        logger.info(`${type} reminder`, {
          invoiceNumber: inv.invoiceNumber,
          dueDate: inv.dueDate,
          grandTotal: inv.grandTotal,
          contactName: inv.contactName,
          contactEmail: inv.contactEmail,
          companyId: inv.companyId,
        });

        // TODO: Send email via Resend (Step 16)
        // In test mode, use @resend.dev addresses
        // await resend.emails.send({
        //   to: inv.contactEmail,
        //   subject: `${type}: Fatura ${inv.invoiceNumber}`,
        //   ...
        // });

        remindersSent++;
      } catch (err) {
        // Never throw on individual invoice failures — log and continue
        logger.error("Failed to process invoice reminder", {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("Billing reminder check complete", {
      reminders_sent: remindersSent,
      skipped_no_email: skippedNoEmail,
    });

    return { reminders_sent: remindersSent, skipped_no_email: skippedNoEmail };
  },
});
