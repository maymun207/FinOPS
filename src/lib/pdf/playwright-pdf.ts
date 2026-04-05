/**
 * Playwright headless PDF generation utility.
 *
 * Launches headless Chromium, navigates to a Next.js RSC render target,
 * and captures the page as an A4 PDF with print-optimized margins.
 *
 * Used by the report-generate Trigger.dev task to produce
 * statutory report PDFs (Mizan, Bilanço, etc.).
 */
import { chromium } from "playwright";

/** PDF generation options */
export interface PDFOptions {
  /** Target URL — should be an RSC render target page */
  url: string;
  /** Optional Clerk JWT for authenticated rendering */
  clerkJwt?: string;
  /** Cookie domain (defaults to localhost) */
  cookieDomain?: string;
  /** Paper format (default: A4) */
  format?: "A4" | "Letter";
}

/**
 * Generate a PDF from a given URL using headless Chromium.
 *
 * @param options - PDF generation configuration
 * @returns Buffer containing the PDF content
 */
export async function generatePDF(options: PDFOptions): Promise<Buffer> {
  const {
    url,
    clerkJwt,
    cookieDomain = "localhost",
    format = "A4",
  } = options;

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      // A4 viewport for consistent rendering
      viewport: { width: 1240, height: 1754 },
    });

    // Inject Clerk auth cookie if provided
    if (clerkJwt) {
      await context.addCookies([
        {
          name: "__clerk_db_jwt",
          value: clerkJwt,
          domain: cookieDomain,
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ]);
    }

    const page = await context.newPage();

    // Navigate and wait for all data to load
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Generate PDF
    const pdf = await page.pdf({
      format,
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
