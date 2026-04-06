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
 *
 * NOTE: Uses jobEnv + own pg.Pool — does NOT import @/server/db or @/env.ts.
 */
import { schedules, logger } from "@trigger.dev/sdk/v3";
import { jobEnv } from "./_env";
import { Pool } from "pg";

interface ReminderInvoice {
  id: string;
  invoice_number: string;
  due_date: string;
  grand_total: string;
  status: string;
  company_id: string;
  contact_name: string | null;
  contact_email: string | null;
}

export const billingReminderDaily = schedules.task({
  id: "billing-reminder-daily",
  cron: "0 5 * * *", // 08:00 Istanbul (UTC+3, no DST)
  run: async () => {
    logger.info("Starting daily billing reminder check");

    const pool = new Pool({ connectionString: jobEnv.SUPABASE_DB_URL, max: 2 });

    try {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0]!;

      // 7 days from now
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split("T")[0]!;

      // Find upcoming invoices (due within 7 days) + overdue
      const { rows: reminderInvoices } = await pool.query<ReminderInvoice>(
        `SELECT i.id, i.invoice_number, i.due_date, i.grand_total, i.status,
                i.company_id, c.name AS contact_name, c.email AS contact_email
         FROM invoices i
         LEFT JOIN contacts c ON i.contact_id = c.id
         WHERE i.direction = 'outbound'
           AND i.status NOT IN ('PAID', 'CANCELLED')
           AND i.due_date <= $1::date
         ORDER BY i.due_date ASC`,
        [nextWeekStr]
      );

      logger.info(`Found ${reminderInvoices.length} invoices due within 7 days or overdue`);

      // Process each invoice — never throw on individual failures
      let remindersSent = 0;
      let skippedNoEmail = 0;

      for (const inv of reminderInvoices) {
        try {
          const isOverdue = inv.due_date && new Date(inv.due_date) < today;
          const type = isOverdue ? "OVERDUE" : "UPCOMING";

          // Check if contact has email
          if (!inv.contact_email) {
            logger.warn(`${type} reminder skipped — contact has no email`, {
              invoiceNumber: inv.invoice_number,
              contactName: inv.contact_name ?? "unknown",
              companyId: inv.company_id,
            });
            skippedNoEmail++;
            continue;
          }

          logger.info(`${type} reminder`, {
            invoiceNumber: inv.invoice_number,
            dueDate: inv.due_date,
            grandTotal: inv.grand_total,
            contactName: inv.contact_name,
            contactEmail: inv.contact_email,
            companyId: inv.company_id,
          });

          // TODO: Send email via Resend using jobEnv.RESEND_API_KEY
          // const { Resend } = await import('resend');
          // const resend = new Resend(jobEnv.RESEND_API_KEY);
          // await resend.emails.send({ ... });

          remindersSent++;
        } catch (err) {
          // Never throw on individual invoice failures — log and continue
          logger.error("Failed to process invoice reminder", {
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      logger.info("Billing reminder check complete", {
        reminders_sent: remindersSent,
        skipped_no_email: skippedNoEmail,
      });

      return { reminders_sent: remindersSent, skipped_no_email: skippedNoEmail };
    } finally {
      await pool.end();
    }
  },
});
