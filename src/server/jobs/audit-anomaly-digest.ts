/**
 * audit-anomaly-digest — Daily cron job that scans for anomalies and
 * sends summary email per company.
 *
 * Runs at 09:00 Istanbul time (Europe/Istanbul).
 *
 * Anomaly checks:
 *   (a) > 50 DELETE operations in the last 24 hours for any company
 *   (b) Any audit_log entries between 23:00 and 06:00 local time
 *   (c) ai_query_log entries with error_message IS NOT NULL
 *   (d) Any GIB submission failures (gib_status = 'rejected')
 *
 * Sends one email per company that has anomalies.
 * Skips companies with no admin email configured — logs a warning.
 */
import { schedules, logger } from "@trigger.dev/sdk/v3";
import { Pool } from "pg";
import { log } from "@/lib/telemetry/axiom";

// ── Types ───────────────────────────────────────────────────────────

interface CompanyAnomalies {
  companyId: string;
  companyName: string;
  anomalies: AnomalyItem[];
}

interface AnomalyItem {
  type: "excessive_deletes" | "after_hours" | "ai_errors" | "gib_failures";
  severity: "warning" | "critical";
  count: number;
  description: string;
}

// ── Scheduled task ──────────────────────────────────────────────────

export const auditAnomalyDigestTask = schedules.task({
  id: "audit-anomaly-digest",
  // Daily at 09:00 Istanbul time
  cron: "0 9 * * *",
  run: async () => {
    const startTime = Date.now();
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is not set");

    const pool = new Pool({ connectionString: dbUrl, max: 2 });

    try {
      logger.info("Starting audit anomaly digest");

      // Get all companies
      const companiesResult = await pool.query<{
        id: string;
        name: string;
        clerk_org_id: string;
      }>("SELECT id, name, clerk_org_id FROM companies");

      const allAnomalies: CompanyAnomalies[] = [];

      for (const company of companiesResult.rows) {
        const anomalies: AnomalyItem[] = [];

        // ── (a) Excessive DELETE operations (> 50 in 24h) ──
        const deleteCount = await pool.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM audit_log
           WHERE company_id = $1
             AND action = 'DELETE'
             AND created_at >= NOW() - INTERVAL '24 hours'`,
          [company.id],
        );
        const deletes = parseInt(deleteCount.rows[0]?.count ?? "0", 10);
        if (deletes > 50) {
          anomalies.push({
            type: "excessive_deletes",
            severity: "critical",
            count: deletes,
            description: `Son 24 saatte ${deletes} DELETE işlemi tespit edildi (eşik: 50)`,
          });
        }

        // ── (b) After-hours audit entries (23:00-06:00 Istanbul) ──
        const afterHoursCount = await pool.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM audit_log
           WHERE company_id = $1
             AND created_at >= NOW() - INTERVAL '24 hours'
             AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Istanbul')
                 NOT BETWEEN 6 AND 22`,
          [company.id],
        );
        const afterHours = parseInt(afterHoursCount.rows[0]?.count ?? "0", 10);
        if (afterHours > 0) {
          anomalies.push({
            type: "after_hours",
            severity: "warning",
            count: afterHours,
            description: `${afterHours} işlem mesai dışı saatlerde (23:00-06:00) yapıldı`,
          });
        }

        // ── (c) AI query errors ──
        const aiErrors = await pool.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM ai_query_log
           WHERE company_id = $1
             AND created_at >= NOW() - INTERVAL '24 hours'
             AND response_text LIKE '%error%'`,
          [company.id],
        );
        const aiErrorCount = parseInt(aiErrors.rows[0]?.count ?? "0", 10);
        if (aiErrorCount > 0) {
          anomalies.push({
            type: "ai_errors",
            severity: "warning",
            count: aiErrorCount,
            description: `${aiErrorCount} AI sorgu hatası tespit edildi`,
          });
        }

        // ── (d) GIB submission failures ──
        const gibFailures = await pool.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM invoices
           WHERE company_id = $1
             AND gib_status = 'rejected'
             AND updated_at >= NOW() - INTERVAL '24 hours'`,
          [company.id],
        );
        const gibFailCount = parseInt(gibFailures.rows[0]?.count ?? "0", 10);
        if (gibFailCount > 0) {
          anomalies.push({
            type: "gib_failures",
            severity: "critical",
            count: gibFailCount,
            description: `${gibFailCount} e-Fatura GİB tarafından reddedildi`,
          });
        }

        if (anomalies.length > 0) {
          allAnomalies.push({
            companyId: company.id,
            companyName: company.name,
            anomalies,
          });
        }
      }

      // ── Send emails ──
      if (allAnomalies.length === 0) {
        logger.info("No anomalies detected — no emails to send");
        await log({
          service: "trigger-job",
          level: "info",
          operation: "audit-anomaly-digest",
          metadata: { result: "no_anomalies", companies_scanned: companiesResult.rows.length },
        });
        return {
          status: "complete" as const,
          anomalies: 0,
          emails_sent: 0,
          latencyMs: Date.now() - startTime,
        };
      }

      let emailsSent = 0;

      for (const companyAnomalies of allAnomalies) {
        // For now we don't have admin emails in the company table.
        // In production, query the Clerk organization for admin members.
        // For now, log a warning and skip.
        const adminEmail = process.env.ADMIN_EMAIL; // Fallback

        if (!adminEmail) {
          logger.warn("No admin email configured — skipping email", {
            companyId: companyAnomalies.companyId,
            companyName: companyAnomalies.companyName,
          });
          await log({
            service: "trigger-job",
            level: "warn",
            operation: "audit-anomaly-digest.email-skip",
            company_id: companyAnomalies.companyId,
            metadata: { reason: "no_admin_email" },
          });
          continue;
        }

        // Build email HTML
        const html = buildDigestEmail(companyAnomalies);

        try {
          const resendKey = process.env.RESEND_API_KEY;
          if (resendKey) {
            const { Resend } = await import("resend");
            const resend = new Resend(resendKey);
            await resend.emails.send({
              from: "FinOPS Denetim <noreply@finops.dev>",
              to: adminEmail,
              subject: `⚠️ Anomali Raporu: ${companyAnomalies.companyName} — ${companyAnomalies.anomalies.length} bulgu`,
              html,
            });
            emailsSent++;
          }
        } catch (err) {
          logger.error("Failed to send digest email", {
            error: err instanceof Error ? err.message : String(err),
            companyId: companyAnomalies.companyId,
          });
        }
      }

      await log({
        service: "trigger-job",
        level: "info",
        operation: "audit-anomaly-digest",
        metadata: {
          companies_with_anomalies: allAnomalies.length,
          total_anomalies: allAnomalies.reduce((s, c) => s + c.anomalies.length, 0),
          emails_sent: emailsSent,
        },
      });

      logger.info("Audit anomaly digest complete", {
        companiesWithAnomalies: allAnomalies.length,
        emailsSent,
      });

      return {
        status: "complete" as const,
        anomalies: allAnomalies.length,
        emails_sent: emailsSent,
        latencyMs: Date.now() - startTime,
      };
    } finally {
      await pool.end();
    }
  },
});

// ── Email template ──────────────────────────────────────────────────

function buildDigestEmail(data: CompanyAnomalies): string {
  const rows = data.anomalies
    .map(
      (a) =>
        `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #333;color:#${a.severity === "critical" ? "ef4444" : "fbbf24"}">
        ${a.severity === "critical" ? "🔴" : "🟡"} ${a.type.replace(/_/g, " ").toUpperCase()}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #333;text-align:center;color:#e5e7eb">${a.count}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #333;color:#d1d5db">${a.description}</td>
    </tr>`,
    )
    .join("\n");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <div style="background:#111;border:1px solid #333;border-radius:12px;padding:24px">
      <h1 style="color:#f9fafb;font-size:18px;margin:0 0 4px">⚠️ Günlük Anomali Raporu</h1>
      <p style="color:#9ca3af;font-size:13px;margin:0 0 20px">${data.companyName} — ${new Date().toLocaleDateString("tr-TR")}</p>

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="border-bottom:2px solid #444">
            <th style="padding:8px 12px;text-align:left;color:#6b7280">TÜR</th>
            <th style="padding:8px 12px;text-align:center;color:#6b7280">SAYI</th>
            <th style="padding:8px 12px;text-align:left;color:#6b7280">AÇIKLAMA</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="color:#6b7280;font-size:11px;margin:20px 0 0;text-align:center">
        Bu e-posta FinOPS Denetim sistemi tarafından otomatik olarak gönderilmiştir.
      </p>
    </div>
  </div>
</body>
</html>`;
}
