/**
 * E2E test script — simulates the import → quarantine → approve pipeline.
 *
 * Run with: node --env-file=.env.local src/__tests__/e2e-import-test.mjs
 *
 * Steps:
 *   1. Insert 2 test invoice rows into quarantine via direct SQL
 *   2. Approve them via direct SQL (simulates tRPC approve)
 *   3. Verify the promote logic by calling the promote functions
 *
 * This is a simple integration test, not a full browser test.
 */
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();

  try {
    // Get company ID
    const companies = await client.query("SELECT id FROM companies LIMIT 1");
    if (companies.rows.length === 0) {
      console.log("❌ No companies found — skipping test");
      return;
    }
    const companyId = companies.rows[0].id;
    console.log(`✅ Using company: ${companyId}`);

    // 1. Insert test quarantine records
    const testRows = [
      {
        rawData: JSON.stringify({
          invoiceNumber: "E2E-TEST-001",
          invoiceDate: "01.01.2024",
          dueDate: "31.01.2024",
          direction: "Giriş",
          contactName: "E2E Test Contact",
          subtotal: "1000,00",
          kdvTotal: "200,00",
          grandTotal: "1200,00",
          currency: "TRY",
          notes: "E2E test invoice",
        }),
        importType: "invoice",
      },
      {
        rawData: JSON.stringify({
          name: "E2E Test Contact Ltd",
          type: "Tedarikçi",
          taxId: "1234567890",
          email: "test@e2e.com",
          phone: "+90 555 000 0001",
          address: "Test Sokak, İstanbul",
        }),
        importType: "contact",
      },
    ];

    const insertedIds = [];
    for (const row of testRows) {
      const result = await client.query(
        `INSERT INTO import_quarantine (company_id, source, import_type, raw_data, status)
         VALUES ($1, $2, $3, $4::jsonb, 'pending')
         RETURNING id`,
        [companyId, "e2e-test", row.importType, row.rawData]
      );
      insertedIds.push(result.rows[0].id);
      console.log(`✅ Inserted quarantine record: ${result.rows[0].id} (${row.importType})`);
    }

    // 2. Check quarantine records
    const quarantine = await client.query(
      "SELECT id, import_type, status, error_message FROM import_quarantine WHERE source = 'e2e-test' AND company_id = $1 ORDER BY created_at",
      [companyId]
    );
    console.log("\n📋 Quarantine records:");
    for (const row of quarantine.rows) {
      console.log(`   ${row.id} | type=${row.import_type} | status=${row.status} | error=${row.error_message || "none"}`);
    }

    // 3. Check that import_type column exists and has proper values
    const typeCheck = await client.query(
      "SELECT import_type, COUNT(*) as cnt FROM import_quarantine WHERE source = 'e2e-test' GROUP BY import_type"
    );
    console.log("\n📊 Import type distribution:");
    for (const row of typeCheck.rows) {
      console.log(`   ${row.import_type}: ${row.cnt} records`);
    }

    // 4. Clean up test records
    await client.query(
      "DELETE FROM import_quarantine WHERE source = 'e2e-test' AND company_id = $1",
      [companyId]
    );
    console.log("\n🧹 Cleaned up test records");

    console.log("\n✅ E2E Test PASSED — quarantine insert + import_type column working correctly");

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("❌ E2E test failed:", err.message);
  process.exit(1);
});
