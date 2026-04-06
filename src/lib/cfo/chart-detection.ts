/**
 * detectChartType — Auto-detect the best chart type from query result shape.
 *
 * 4-rule algorithm (from spec):
 *   Rule 1: date/period column + exactly 1 numeric → line chart (trend)
 *   Rule 2: category column + exactly 1 numeric → bar chart
 *   Rule 3: two numeric columns matching debit/credit pattern → grouped bar
 *   Rule 4: one row with one numeric → KPI card (Tremor Metric)
 *   Default: table only (AG Grid, no chart)
 */

export type ChartType = "line" | "bar" | "grouped_bar" | "kpi" | "table_only";

/** Column metadata inferred from query result rows */
export interface ColumnMeta {
  name: string;
  type: "date" | "numeric" | "string";
}

// Common date/period column name patterns (Turkish + English)
const DATE_PATTERNS =
  /^(date|tarih|period|donem|dönem|ay|month|year|yil|yıl|created_at|updated_at|invoice_date|fatura_tarihi|due_date|vade_tarihi)/i;

// Common category/label column name patterns
const CATEGORY_PATTERNS =
  /^(name|ad|isim|category|kategori|type|tip|tür|code|kod|account|hesap|contact|cari|description|açıklama|aciklama)/i;

// Debit/credit pairs
const DEBIT_CREDIT_PATTERNS = /^(debit|borc|borç|credit|alacak|total_debit|total_credit|toplam_borc|toplam_alacak)/i;

/**
 * Infer column types from the first row of query results.
 */
export function inferColumns(rows: Record<string, unknown>[]): ColumnMeta[] {
  if (rows.length === 0) return [];

  const firstRow = rows[0]!;
  return Object.entries(firstRow).map(([name, value]) => {
    // Check if the value looks like a date
    if (typeof value === "string" && !isNaN(Date.parse(value)) && DATE_PATTERNS.test(name)) {
      return { name, type: "date" as const };
    }
    // Check if it's numeric
    if (typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)) && value.trim() !== "")) {
      // Distinguish between numeric IDs/codes and actual values
      if (DATE_PATTERNS.test(name)) return { name, type: "date" as const };
      return { name, type: "numeric" as const };
    }
    // Everything else is a string/category
    return { name, type: "string" as const };
  });
}

/**
 * Detect the best chart type for the given query results.
 */
export function detectChartType(rows: Record<string, unknown>[]): ChartType {
  if (rows.length === 0) return "table_only";

  const cols = inferColumns(rows);
  const dateCols = cols.filter((c) => c.type === "date");
  const numericCols = cols.filter((c) => c.type === "numeric");
  const stringCols = cols.filter((c) => c.type === "string");

  // Rule 4: one row with one numeric → KPI card
  if (rows.length === 1 && numericCols.length === 1) {
    return "kpi";
  }

  // Rule 3: two or more numeric columns that look like debit/credit → grouped bar
  const debitCreditCols = numericCols.filter((c) => DEBIT_CREDIT_PATTERNS.test(c.name));
  if (debitCreditCols.length >= 2) {
    return "grouped_bar";
  }

  // Rule 1: date/period column + exactly 1 numeric → line chart
  if (dateCols.length > 0 && numericCols.length === 1) {
    return "line";
  }

  // Rule 2: category column + exactly 1 numeric → bar chart
  if (stringCols.length > 0 && numericCols.length === 1 && rows.length <= 20) {
    return "bar";
  }

  // Default: table only (no chart matches)
  return "table_only";
}
