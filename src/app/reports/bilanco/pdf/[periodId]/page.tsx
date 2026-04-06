/**
 * Bilanço PDF Render Target — React Server Component.
 *
 * Print-optimized balance sheet with aktif/pasif/özkaynak sections
 * for Playwright PDF capture.
 *
 * Route: /reports/bilanco/pdf/[periodId]
 */
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import React from "react";

interface BilancoRow {
  account_type: string;
  account_code: string;
  account_name: string | null;
  balance: number;
}

const TYPE_LABELS: Record<string, string> = {
  asset: "AKTİF (Varlıklar)",
  liability: "PASİF (Yükümlülükler)",
  equity: "ÖZKAYNAK",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function BilancoPDFPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;

  const cached = await db.execute(
    sql`SELECT data FROM cached_report_results
        WHERE report_type = 'balance_sheet'
        LIMIT 1`
  );

  const rows = (cached.rows as { data: BilancoRow[] }[])[0]?.data ?? [];

  const company = await db.execute(
    sql`SELECT name FROM companies LIMIT 1`
  );
  const companyName = (company.rows as { name: string }[])[0]?.name ?? "Şirket";

  // Group by type
  const groups = new Map<string, BilancoRow[]>();
  for (const r of rows) {
    if (!groups.has(r.account_type)) groups.set(r.account_type, []);
    const group = groups.get(r.account_type);
    if (group) group.push(r);
  }

  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <title>Bilanço — {companyName}</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @page { size: A4 portrait; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; }
          .header { text-align: center; padding: 20px 0 12px; }
          .header h1 { font-size: 16pt; color: #1B2B4B; margin-bottom: 4px; }
          .header .sub { font-size: 8pt; color: #666; }
          .section { margin-top: 16px; }
          .section-title { background: #f0f4f8; padding: 6px 12px; font-weight: bold; color: #1B2B4B; border-left: 3px solid #1B2B4B; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #1B2B4B; color: #fff; padding: 6px 10px; text-align: left; font-size: 9pt; }
          th:last-child { text-align: right; }
          td { padding: 4px 10px; border-bottom: 1px solid #e0e0e0; font-size: 9pt; }
          td:last-child { text-align: right; }
          .subtotal td { font-weight: bold; background: #e8ecf1; }
        `,
          }}
        />
      </head>
      <body>
        <div className="header">
          <h1>{companyName} — BİLANÇO</h1>
          <p className="sub">Dönem ID: {periodId}</p>
        </div>

        {Array.from(groups.entries()).map(([type, groupRows]) => {
          const subtotal = groupRows.reduce((s, r) => s + r.balance, 0);
          return (
            <div key={type} className="section">
              <div className="section-title">{TYPE_LABELS[type] ?? type}</div>
              <table>
                <thead>
                  <tr>
                    <th>Hesap Kodu</th>
                    <th>Hesap Adı</th>
                    <th>Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.account_code}</td>
                      <td>{r.account_name ?? ""}</td>
                      <td>{formatCurrency(r.balance)}</td>
                    </tr>
                  ))}
                  <tr className="subtotal">
                    <td colSpan={2}>{TYPE_LABELS[type] ?? type} Toplamı</td>
                    <td>{formatCurrency(subtotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </body>
    </html>
  );
}
