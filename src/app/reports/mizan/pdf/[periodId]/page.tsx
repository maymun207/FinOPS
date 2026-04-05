/**
 * Mizan PDF Render Target — React Server Component.
 *
 * A print-optimized page that renders the trial balance (Mizan)
 * as a static HTML table for Playwright PDF capture.
 *
 * Route: /reports/mizan/pdf/[periodId]
 * No layout chrome — just the report content.
 */
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import React from "react";

interface MizanRow {
  account_code: string;
  account_name: string | null;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
  net_balance: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function MizanPDFPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;

  // Read cached mizan data
  const cached = await db.execute(
    sql`SELECT data FROM cached_report_results
        WHERE report_type = 'trial_balance'
        LIMIT 1`
  );

  const rows = (cached.rows as Array<{ data: MizanRow[] }>)[0]?.data ?? [];

  // Company name
  const company = await db.execute(
    sql`SELECT name FROM companies LIMIT 1`
  );
  const companyName = (company.rows as Array<{ name: string }>)[0]?.name ?? "Şirket";

  const totalOpenDebit = rows.reduce((s, r) => s + Number(r.opening_debit), 0);
  const totalOpenCredit = rows.reduce((s, r) => s + Number(r.opening_credit), 0);
  const totalPeriodDebit = rows.reduce((s, r) => s + Number(r.period_debit), 0);
  const totalPeriodCredit = rows.reduce((s, r) => s + Number(r.period_credit), 0);
  const totalCloseDebit = rows.reduce((s, r) => s + Number(r.closing_debit), 0);
  const totalCloseCredit = rows.reduce((s, r) => s + Number(r.closing_credit), 0);
  const totalNet = rows.reduce((s, r) => s + Number(r.net_balance), 0);

  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <title>Mizan — {companyName}</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @page { size: A4 landscape; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background-color: #fff; }
          .header { text-align: center; padding: 16px 0 8px; background-color: #fff; }
          .header h1 { font-size: 16pt; color: #1B2B4B; margin-bottom: 4px; }
          .header .sub { font-size: 8pt; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background-color: #1B2B4B; color: #fff; padding: 6px 8px; font-size: 8pt; text-align: right; }
          th:first-child, th:nth-child(2) { text-align: left; }
          td { padding: 4px 8px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; text-align: right; background-color: #fff; }
          td:first-child, td:nth-child(2) { text-align: left; }
          tr:nth-child(even) td { background-color: #f9fafb; }
          .total td { font-weight: bold; background-color: #e8ecf1; border-top: 2px solid #1B2B4B; }
          @media print {
            body { background-color: #fff; }
            button, a, nav, .no-print { display: none !important; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
          }
        `,
          }}
        />
      </head>
      <body>
        <div className="header">
          <h1>{companyName} — MİZAN</h1>
          <p className="sub">Dönem ID: {periodId}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Hesap Kodu</th>
              <th>Hesap Adı</th>
              <th>Açılış Borç</th>
              <th>Açılış Alacak</th>
              <th>Dönem Borç</th>
              <th>Dönem Alacak</th>
              <th>Kapanış Borç</th>
              <th>Kapanış Alacak</th>
              <th>Bakiye</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.account_code}</td>
                <td>{r.account_name ?? ""}</td>
                <td>{formatCurrency(Number(r.opening_debit))}</td>
                <td>{formatCurrency(Number(r.opening_credit))}</td>
                <td>{formatCurrency(Number(r.period_debit))}</td>
                <td>{formatCurrency(Number(r.period_credit))}</td>
                <td>{formatCurrency(Number(r.closing_debit))}</td>
                <td>{formatCurrency(Number(r.closing_credit))}</td>
                <td>{formatCurrency(Number(r.net_balance))}</td>
              </tr>
            ))}
            <tr className="total">
              <td>TOPLAM</td>
              <td></td>
              <td>{formatCurrency(totalOpenDebit)}</td>
              <td>{formatCurrency(totalOpenCredit)}</td>
              <td>{formatCurrency(totalPeriodDebit)}</td>
              <td>{formatCurrency(totalPeriodCredit)}</td>
              <td>{formatCurrency(totalCloseDebit)}</td>
              <td>{formatCurrency(totalCloseCredit)}</td>
              <td>{formatCurrency(totalNet)}</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
