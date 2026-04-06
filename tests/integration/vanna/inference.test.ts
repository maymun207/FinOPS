/**
 * @vitest-environment node
 *
 * Integration tests: Vanna inference pipeline.
 *
 * Tests:
 *   1. Training corpus has exactly 50 pairs
 *   2. Training corpus covers all 7 required categories
 *   3. All training SQL starts with SELECT or WITH
 *   4. All training SQL contains company_id reference
 *   5. All training SQL contains LIMIT clause
 *   6. validateSQL rejects INSERT/UPDATE/DELETE
 *   7. validateSQL rejects queries without company_id
 *   8. validateSQL rejects pg_sleep and dangerous functions
 *   9. validateSQL accepts valid SELECT with company_id
 *  10. validateSQL accepts WITH (CTE) queries
 *  11. Schema context contains all required tables
 *  12. System prompt contains safety rules
 */
import { describe, it, expect } from "vitest";
import { TRAINING_CORPUS } from "@/lib/vanna/training-corpus";
import { SCHEMA_CONTEXT, SYSTEM_PROMPT } from "@/lib/vanna/schema-context";
import { validateSQL, extractTableNames, extractCTENames, ALLOWED_TABLES } from "@/server/jobs/vanna-inference";

describe("Training Corpus", () => {
  it("has exactly 50 training pairs", () => {
    expect(TRAINING_CORPUS.length).toBe(50);
  });

  it("covers all 7 required categories", () => {
    const categories = new Set(TRAINING_CORPUS.map((p) => p.category));
    expect(categories.has("kdv")).toBe(true);
    expect(categories.has("receivables")).toBe(true);
    expect(categories.has("trial_balance")).toBe(true);
    expect(categories.has("cashflow")).toBe(true);
    expect(categories.has("invoice")).toBe(true);
    expect(categories.has("journal")).toBe(true);
    expect(categories.has("expense")).toBe(true);
    expect(categories.size).toBe(7);
  });

  it("KDV category has 8 questions", () => {
    expect(TRAINING_CORPUS.filter((p) => p.category === "kdv").length).toBe(8);
  });

  it("Receivables category has 8 questions", () => {
    expect(TRAINING_CORPUS.filter((p) => p.category === "receivables").length).toBe(8);
  });

  it("Invoice category has 8 questions", () => {
    expect(TRAINING_CORPUS.filter((p) => p.category === "invoice").length).toBe(8);
  });

  it("Expense category has 8 questions", () => {
    expect(TRAINING_CORPUS.filter((p) => p.category === "expense").length).toBe(8);
  });

  it("Trial Balance category has 6 questions", () => {
    expect(TRAINING_CORPUS.filter((p) => p.category === "trial_balance").length).toBe(6);
  });

  it("Cash Flow category has 6 questions", () => {
    expect(TRAINING_CORPUS.filter((p) => p.category === "cashflow").length).toBe(6);
  });

  it("Journal category has 6 questions", () => {
    expect(TRAINING_CORPUS.filter((p) => p.category === "journal").length).toBe(6);
  });

  it("all SQL starts with SELECT or WITH", () => {
    for (const pair of TRAINING_CORPUS) {
      const trimmed = pair.sql.trim();
      expect(
        /^\s*(SELECT|WITH)\b/i.test(trimmed),
        `Pair "${pair.question}" SQL doesn't start with SELECT/WITH: ${trimmed.substring(0, 50)}`,
      ).toBe(true);
    }
  });

  it("all SQL contains company_id reference", () => {
    for (const pair of TRAINING_CORPUS) {
      expect(
        pair.sql.includes("company_id"),
        `Pair "${pair.question}" SQL missing company_id filter`,
      ).toBe(true);
    }
  });

  it("all SQL contains LIMIT clause", () => {
    for (const pair of TRAINING_CORPUS) {
      expect(
        /LIMIT\s+\d+/i.test(pair.sql),
        `Pair "${pair.question}" SQL missing LIMIT clause`,
      ).toBe(true);
    }
  });
});

describe("SQL Safety Validation", () => {
  it("rejects INSERT statements", () => {
    const result = validateSQL("INSERT INTO users (name) VALUES ('test') WHERE company_id = $1");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("SELECT");
  });

  it("rejects UPDATE statements", () => {
    const result = validateSQL("UPDATE invoices SET status = 'paid' WHERE company_id = $1");
    expect(result.safe).toBe(false);
  });

  it("rejects DELETE statements", () => {
    const result = validateSQL("DELETE FROM invoices WHERE company_id = $1");
    expect(result.safe).toBe(false);
  });

  it("rejects DROP TABLE", () => {
    const result = validateSQL("SELECT 1; DROP TABLE invoices; -- WHERE company_id = $1");
    expect(result.safe).toBe(false);
  });

  it("rejects queries without company_id", () => {
    const result = validateSQL("SELECT * FROM invoices LIMIT 10");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("company_id");
  });

  it("rejects pg_sleep", () => {
    const result = validateSQL("SELECT pg_sleep(10) WHERE company_id = $1");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("Dangerous");
  });

  it("rejects dblink", () => {
    const result = validateSQL("SELECT * FROM dblink('host=evil') WHERE company_id = $1");
    expect(result.safe).toBe(false);
  });

  it("rejects multiple statements (semicolons)", () => {
    const result = validateSQL("SELECT 1 WHERE company_id = $1; SELECT 2;");
    expect(result.safe).toBe(false);
  });

  it("accepts valid SELECT with company_id", () => {
    const result = validateSQL(
      "SELECT * FROM invoices WHERE company_id = $1 LIMIT 10",
    );
    expect(result.safe).toBe(true);
  });

  it("accepts WITH (CTE) queries", () => {
    const result = validateSQL(
      `WITH totals AS (
        SELECT SUM(debit) as total FROM journal_entry_lines
        JOIN journal_entries ON journal_entries.id = journal_entry_lines.journal_entry_id
        WHERE company_id = $1
      )
      SELECT * FROM totals LIMIT 10`,
    );
    expect(result.safe).toBe(true);
  });
});

describe("Schema Context", () => {
  it("contains all required tables", () => {
    const requiredTables = [
      "companies",
      "fiscal_periods",
      "chart_of_accounts",
      "contacts",
      "invoices",
      "invoice_line_items",
      "journal_entries",
      "journal_entry_lines",
      "payments",
    ];

    for (const table of requiredTables) {
      expect(
        SCHEMA_CONTEXT.includes(table),
        `Schema context missing table: ${table}`,
      ).toBe(true);
    }
  });

  it("contains TDHP account code explanations", () => {
    expect(SCHEMA_CONTEXT).toContain("TDHP");
    expect(SCHEMA_CONTEXT).toContain("1xx");
    expect(SCHEMA_CONTEXT).toContain("6xx");
    expect(SCHEMA_CONTEXT).toContain("7xx");
  });

  it("contains KDV rate information", () => {
    expect(SCHEMA_CONTEXT).toContain("KDV");
    expect(SCHEMA_CONTEXT).toContain("1%");
    expect(SCHEMA_CONTEXT).toContain("20%");
  });
});

describe("System Prompt", () => {
  it("enforces SELECT-only rule", () => {
    expect(SYSTEM_PROMPT).toContain("SELECT");
    expect(SYSTEM_PROMPT).toContain("YASAKTIR");
  });

  it("requires company_id filter", () => {
    expect(SYSTEM_PROMPT).toContain("company_id");
    expect(SYSTEM_PROMPT).toContain("$1");
  });

  it("specifies Turkish aliases", () => {
    expect(SYSTEM_PROMPT).toContain("Türkçe alias");
  });

  it("limits results to 100", () => {
    expect(SYSTEM_PROMPT).toContain("LIMIT 100");
  });

  it("blocks dangerous functions", () => {
    expect(SYSTEM_PROMPT).toContain("pg_sleep");
    expect(SYSTEM_PROMPT).toContain("dblink");
  });
});

describe("Table Name Extraction", () => {
  it("extracts single table from simple SELECT", () => {
    const tables = extractTableNames("SELECT * FROM invoices WHERE company_id = $1");
    expect(tables).toEqual(["invoices"]);
  });

  it("extracts multiple tables from JOIN", () => {
    const tables = extractTableNames(
      "SELECT * FROM invoices JOIN contacts ON contacts.id = invoices.contact_id WHERE invoices.company_id = $1",
    );
    expect(tables).toContain("invoices");
    expect(tables).toContain("contacts");
  });

  it("extracts from subquery correctly", () => {
    const tables = extractTableNames(
      "SELECT * FROM journal_entries je JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id WHERE je.company_id = $1",
    );
    expect(tables).toContain("journal_entries");
    expect(tables).toContain("journal_entry_lines");
  });

  it("handles schema-qualified names", () => {
    const tables = extractTableNames("SELECT * FROM public.invoices WHERE company_id = $1");
    expect(tables).toContain("invoices");
  });

  it("deduplicates table names", () => {
    const tables = extractTableNames(
      "SELECT * FROM invoices i1 JOIN invoices i2 ON i1.id = i2.id WHERE i1.company_id = $1",
    );
    expect(tables.filter((t) => t === "invoices").length).toBe(1);
  });
});

describe("Table Name Allowlist", () => {
  it("ALLOWED_TABLES contains exactly 9 tables", () => {
    expect(ALLOWED_TABLES.size).toBe(9);
  });

  it("ALLOWED_TABLES matches schema context tables", () => {
    const schemaTablePattern = /CREATE TABLE (\w+)/gi;
    const schemaTables: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = schemaTablePattern.exec(SCHEMA_CONTEXT)) !== null) {
      if (m[1]) schemaTables.push(m[1].toLowerCase());
    }
    for (const table of schemaTables) {
      expect(ALLOWED_TABLES.has(table), `Schema table ${table} not in ALLOWED_TABLES`).toBe(true);
    }
  });

  it("rejects queries referencing pg_catalog tables", () => {
    const result = validateSQL(
      "SELECT * FROM pg_catalog.pg_tables WHERE company_id = $1 LIMIT 10",
    );
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("not allowed");
  });

  it("rejects queries referencing information_schema", () => {
    const result = validateSQL(
      "SELECT * FROM information_schema.columns WHERE company_id = $1 LIMIT 10",
    );
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("not allowed");
  });

  it("rejects queries referencing non-existent custom tables", () => {
    const result = validateSQL(
      "SELECT * FROM users WHERE company_id = $1 LIMIT 10",
    );
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("not allowed");
  });

  it("accepts queries using only allowed tables", () => {
    const result = validateSQL(
      "SELECT i.*, c.name FROM invoices i JOIN contacts c ON c.id = i.contact_id WHERE i.company_id = $1 LIMIT 10",
    );
    expect(result.safe).toBe(true);
  });

  it("all training corpus SQL uses only allowed tables", () => {
    for (const pair of TRAINING_CORPUS) {
      const tables = extractTableNames(pair.sql);
      for (const table of tables) {
        expect(
          ALLOWED_TABLES.has(table),
          `Training pair "${pair.question}" references disallowed table: ${table}`,
        ).toBe(true);
      }
    }
  });
});
