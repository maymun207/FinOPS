/**
 * @vitest-environment node
 *
 * Integration tests: Playwright PDF generation utility.
 *
 * Tests:
 *   1. generatePDF module exports correctly
 *   2. PDFOptions interface accepts all required fields
 *   3. PDF generation with data URL → buffer starts with '%PDF-1.' magic bytes
 *   4. PDF file size is between 50KB and 5MB (sanity range check)
 */
import { describe, it, expect } from "vitest";
import { generatePDF, type PDFOptions } from "@/lib/pdf/playwright-pdf";

describe("Playwright PDF Generation", () => {
  it("module exports generatePDF function", () => {
    expect(typeof generatePDF).toBe("function");
  });

  it("PDFOptions interface accepts all required fields", () => {
    const options: PDFOptions = {
      url: "http://localhost:3000/reports/mizan/pdf/test-period",
      clerkJwt: "test-jwt-token",
      cookieDomain: "localhost",
      format: "A4",
    };

    expect(options.url).toContain("mizan");
    expect(options.format).toBe("A4");
    expect(options.clerkJwt).toBeDefined();
  });

  // Shared buffer for the remaining tests
  let pdfBuffer: Buffer | null = null;

  it("PDF generation → returned buffer starts with '%PDF-1.' magic bytes", async () => {
    const htmlContent = `
      <html>
        <head>
          <style>
            @page { size: A4; margin: 0; }
            * { -webkit-print-color-adjust: exact !important; }
            body { font-family: Arial, sans-serif; background-color: #fff; }
            table { width: 100%; border-collapse: collapse; }
            th { background-color: #1B2B4B; color: #fff; padding: 6px 8px; }
            td { padding: 4px 8px; border-bottom: 1px solid #e0e0e0; background-color: #fff; }
            tr:nth-child(even) td { background-color: #f9fafb; }
            .total td { font-weight: bold; background-color: #e8ecf1; }
          </style>
        </head>
        <body>
          <h1 style="text-align:center;color:#1B2B4B;">Test AŞ — MİZAN</h1>
          <table>
            <thead>
              <tr><th>Hesap Kodu</th><th>Hesap Adı</th><th>Borç</th><th>Alacak</th><th>Bakiye</th></tr>
            </thead>
            <tbody>
              <tr><td>100</td><td>Kasa</td><td>12.000,00</td><td>8.000,00</td><td>4.000,00</td></tr>
              <tr><td>102</td><td>Bankalar</td><td>25.000,00</td><td>10.000,00</td><td>15.000,00</td></tr>
              <tr><td>120</td><td>Alıcılar</td><td>18.000,00</td><td>5.000,00</td><td>13.000,00</td></tr>
              <tr><td>320</td><td>Satıcılar</td><td>8.000,00</td><td>12.000,00</td><td>-4.000,00</td></tr>
              <tr><td>600</td><td>Yurt İçi Satışlar</td><td>0,00</td><td>50.000,00</td><td>-50.000,00</td></tr>
              <tr><td>770</td><td>Genel Yönetim Giderleri</td><td>15.000,00</td><td>0,00</td><td>15.000,00</td></tr>
              <tr class="total"><td>TOPLAM</td><td></td><td>78.000,00</td><td>85.000,00</td><td>-7.000,00</td></tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;

    try {
      pdfBuffer = await generatePDF({ url: dataUrl });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("Executable doesn't exist") || msg.includes("browserType.launch")) {
        console.warn("Skipping PDF test: Playwright Chromium not installed");
        return;
      }
      throw e;
    }

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer!.length).toBeGreaterThan(0);

    // PDF magic bytes: %PDF-1. → 0x25 0x50 0x44 0x46 0x2D 0x31 0x2E
    expect(pdfBuffer![0]).toBe(0x25); // %
    expect(pdfBuffer![1]).toBe(0x50); // P
    expect(pdfBuffer![2]).toBe(0x44); // D
    expect(pdfBuffer![3]).toBe(0x46); // F
    expect(pdfBuffer![4]).toBe(0x2d); // -
    expect(pdfBuffer![5]).toBe(0x31); // 1
    expect(pdfBuffer![6]).toBe(0x2e); // .

    // Also verify as string
    const header = pdfBuffer!.subarray(0, 8).toString("ascii");
    expect(header).toMatch(/^%PDF-1\./);
  }, 30000);

  it("PDF file size is between 50KB and 5MB (sanity range check)", () => {
    if (!pdfBuffer) {
      console.warn("Skipping size check: PDF not generated (Playwright may not be installed)");
      return;
    }

    const sizeKB = pdfBuffer.length / 1024;
    const sizeMB = sizeKB / 1024;

    // Expect a real PDF to be > 50KB and < 5MB
    // A simple single-page PDF with a table is typically 80-300KB
    expect(sizeKB).toBeGreaterThan(50);
    expect(sizeMB).toBeLessThan(5);
  });
});
