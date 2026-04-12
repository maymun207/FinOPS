/**
 * Excel Template Generators for FinOPS Import.
 *
 * Each function creates a pre-formatted .xlsx workbook in memory and
 * triggers a browser download. Column headers use the same Turkish labels
 * as the ColumnMappingGrid target fields so auto-mapping works on upload.
 *
 * IMPORTANT: These functions use browser APIs (Blob, URL.createObjectURL)
 * and must only be called from client components.
 *
 * Template headers are aligned to the exact field names in:
 *   - INVOICE_FIELDS  in ColumnMappingGrid.tsx
 *   - CONTACT_FIELDS  in ColumnMappingGrid.tsx
 *   - JOURNAL_FIELDS  in ColumnMappingGrid.tsx
 * and validated by their respective Zod schemas.
 */
import ExcelJS from "exceljs";

// ── Shared helpers ───────────────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1D4E89" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

const INFO_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF334155" },
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.height = 22;
  row.alignment = { vertical: "middle", horizontal: "left" };
  row.eachCell((cell) => {
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF2563EB" } },
    };
  });
}

function styleInfoHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = INFO_HEADER_FILL;
  row.height = 20;
}

function triggerDownload(buffer: ArrayBuffer | Buffer<ArrayBufferLike>, filename: string) {
  // Wrap in Uint8Array — always a valid BlobPart, works with both ArrayBuffer and SharedArrayBuffer
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoke to allow Firefox time to initiate download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Invoice Template ─────────────────────────────────────────────────────────

/**
 * Downloads finops-fatura-sablonu.xlsx
 *
 * Headers match INVOICE_FIELDS in ColumnMappingGrid.tsx and
 * invoiceImportRowSchema field names:
 *   invoiceNumber, direction, invoiceDate, dueDate, contactName,
 *   subtotal, kdvRate, kdvTotal, grandTotal, currency, description
 *
 * direction: "Giriş" → inbound (alış), "Çıkış" → outbound (satış)
 * Dates:     DD.MM.YYYY  (parseExcelDate handles this format)
 * Numbers:   Turkish format — dot=thousands, comma=decimal (e.g. 1.250,00)
 */
export async function downloadInvoiceTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();
  wb.modified = new Date();

  // ── Data sheet ──────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Faturalar");

  ws.columns = [
    { header: "Fatura No",     key: "invoiceNumber", width: 18 },
    { header: "Yön",           key: "direction",     width: 10 },
    { header: "Fatura Tarihi", key: "invoiceDate",   width: 16 },
    { header: "Vade Tarihi",   key: "dueDate",       width: 16 },
    { header: "Cari Adı",      key: "contactName",   width: 30 },
    { header: "Ara Toplam",    key: "subtotal",      width: 16 },
    { header: "KDV Oranı",     key: "kdvRate",       width: 12 },
    { header: "KDV Tutarı",    key: "kdvTotal",      width: 16 },
    { header: "Genel Toplam",  key: "grandTotal",    width: 16 },
    { header: "Para Birimi",   key: "currency",      width: 13 },
    { header: "Açıklama",      key: "description",   width: 36 },
  ];

  styleHeaderRow(ws.getRow(1));
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Sample rows
  ws.addRow(["FAT-2024-001", "Giriş",  "01.01.2024", "31.01.2024", "Acme Tedarik Ltd",   "10000,00", "20", "2000,00", "12000,00", "TRY", "Ofis malzemesi alımı"]);
  ws.addRow(["FAT-2024-002", "Çıkış",  "15.01.2024", "15.02.2024", "Beta Müşteri A.Ş.",  "5000,00",  "20", "1000,00", "6000,00",  "TRY", "Danışmanlık hizmeti"]);
  ws.addRow(["FAT-2024-003", "Giriş",  "20.01.2024", "20.02.2024", "Gamma Tedarik Ltd",  "1250,00",  "8",  "100,00",  "1350,00",  "TRY", "Kırtasiye alımı"]);

  // Light alternating row shading for readability
  [2, 3, 4].forEach((rowNum) => {
    const row = ws.getRow(rowNum);
    if (rowNum % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2A44" } };
    }
  });

  // ── Instructions sheet ─────────────────────────────────────────────────────
  const info = wb.addWorksheet("Açıklamalar");
  info.getColumn(1).width = 22;
  info.getColumn(2).width = 65;

  const infoHeader = info.addRow(["SÜTUN", "AÇIKLAMA"]);
  styleInfoHeaderRow(infoHeader);

  const infoRows: [string, string][] = [
    ["Fatura No",    "Zorunlu. Her fatura için benzersiz numara. Örn: FAT-2024-001"],
    ["Yön",          '"Giriş" = alış faturası (inbound), "Çıkış" = satış faturası (outbound)'],
    ["Fatura Tarihi","Zorunlu. GG.AA.YYYY formatında — örn: 01.01.2024"],
    ["Vade Tarihi",  "Zorunlu. GG.AA.YYYY formatında — örn: 31.01.2024"],
    ["Cari Adı",     "Zorunlu. Sistemde yoksa otomatik oluşturulur."],
    ["Ara Toplam",   "KDV hariç tutar. Türk formatı: virgül ondalık ayracı. Örn: 1.250,00"],
    ["KDV Oranı",    "Sadece şu değerler kabul edilir: 0, 1, 8, 10, 20"],
    ["KDV Tutarı",   "Hesaplanan KDV tutarı. Türk formatı: 1.250,00"],
    ["Genel Toplam", "KDV dahil toplam tutar. Türk formatı: 1.250,00"],
    ["Para Birimi",  "TRY, USD veya EUR"],
    ["Açıklama",     "Fatura satırı açıklaması — isteğe bağlı."],
    ["",             ""],
    ["⚠️ ÖNEMLİ",  "Her satır bir fatura satırını temsil eder. Aynı Fatura No'lu birden fazla satır birleştirilir."],
  ];

  infoRows.forEach(([col, desc]) => {
    const row = info.addRow([col, desc]);
    if (col === "⚠️ ÖNEMLİ") {
      row.font = { bold: true, color: { argb: "FFFBBF24" } };
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(buffer, "finops-fatura-sablonu.xlsx");
}

// ── Contact Template ─────────────────────────────────────────────────────────

/**
 * Downloads finops-cari-sablonu.xlsx
 *
 * Headers match CONTACT_FIELDS in ColumnMappingGrid.tsx and
 * contactImportRowSchema field names:
 *   name, type, taxId, email, phone, address
 *
 * type: "Tedarikçi" → vendor, "Müşteri" → customer, "İkisi de" → both
 */
export async function downloadContactTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();
  wb.modified = new Date();

  // ── Data sheet ──────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Cari Kartlar");

  ws.columns = [
    { header: "Cari Adı",   key: "name",    width: 32 },
    { header: "Cari Türü",  key: "type",    width: 16 },
    { header: "VKN / TC",   key: "taxId",   width: 16 },
    { header: "E-posta",    key: "email",   width: 28 },
    { header: "Telefon",    key: "phone",   width: 20 },
    { header: "Adres",      key: "address", width: 40 },
  ];

  styleHeaderRow(ws.getRow(1));
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Sample rows
  ws.addRow(["Acme Tedarik Ltd",   "Tedarikçi", "1234567890", "info@acme.com",    "+90 212 555 0001", "Kadıköy, İstanbul"]);
  ws.addRow(["Beta Müşteri A.Ş.", "Müşteri",    "9876543210", "beta@beta.com",    "+90 312 555 0002", "Çankaya, Ankara"]);
  ws.addRow(["Gamma Ortak Ltd",    "İkisi de",  "5555555550", "gamma@gamma.com",  "",                 "Konak, İzmir"]);

  [2, 3, 4].forEach((rowNum) => {
    if (rowNum % 2 === 0) {
      ws.getRow(rowNum).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2A44" } };
    }
  });

  // ── Instructions sheet ─────────────────────────────────────────────────────
  const info = wb.addWorksheet("Açıklamalar");
  info.getColumn(1).width = 22;
  info.getColumn(2).width = 65;

  styleInfoHeaderRow(info.addRow(["SÜTUN", "AÇIKLAMA"]));

  const infoRows: [string, string][] = [
    ["Cari Adı",   "Zorunlu. Cari kartın tam adı. Örn: Acme Tedarik Ltd"],
    ["Cari Türü",  '"Tedarikçi" = vendor (alış), "Müşteri" = customer (satış), "İkisi de" = both'],
    ["VKN / TC",   "10 haneli vergi numarası (VKN) veya 11 haneli TC kimlik numarası. İsteğe bağlı."],
    ["E-posta",    "Geçerli e-posta adresi. İsteğe bağlı."],
    ["Telefon",    "Uluslararası formatta tercih edilir: +90 212 555 0000. İsteğe bağlı."],
    ["Adres",      "Serbest metin adres alanı. İsteğe bağlı."],
  ];

  infoRows.forEach(([col, desc]) => info.addRow([col, desc]));

  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(buffer, "finops-cari-sablonu.xlsx");
}

// ── Journal Entry Template ───────────────────────────────────────────────────

/**
 * Downloads finops-yevmiye-sablonu.xlsx
 *
 * Headers match JOURNAL_FIELDS in ColumnMappingGrid.tsx and
 * journalImportRowSchema field names:
 *   entryDate (→ "Tarih"), description, accountCode,
 *   debitAmount (→ "Borç"), creditAmount (→ "Alacak"),
 *   lineDescription (→ "Satır Açıklaması")
 *
 * Each journal entry needs ≥2 rows. Total Borç must equal total Alacak.
 */
export async function downloadJournalTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();
  wb.modified = new Date();

  // ── Data sheet ──────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Yevmiye");

  ws.columns = [
    { header: "Tarih",           key: "entryDate",       width: 16 },
    { header: "Açıklama",        key: "description",     width: 34 },
    { header: "Hesap Kodu",      key: "accountCode",     width: 14 },
    { header: "Borç",            key: "debitAmount",     width: 16 },
    { header: "Alacak",          key: "creditAmount",    width: 16 },
    { header: "Satır Açıklaması",key: "lineDescription", width: 34 },
  ];

  styleHeaderRow(ws.getRow(1));
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Sample entry 1: Kira gideri (2 rows, balanced)
  ws.addRow(["01.01.2024", "Kira gideri Ocak 2024", "770", "5000,00", "0,00",    "Genel yönetim giderleri"]);
  ws.addRow(["01.01.2024", "Kira gideri Ocak 2024", "102", "0,00",    "5000,00", "Banka ödemesi"]);

  // Sample entry 2: Satış faturası alındı (3 rows, balanced)
  ws.addRow(["15.01.2024", "Satış faturası FAT-2024-001", "120", "12000,00", "0,00",    "Alacak kaydı"]);
  ws.addRow(["15.01.2024", "Satış faturası FAT-2024-001", "600", "0,00",     "10000,00","Satış geliri"]);
  ws.addRow(["15.01.2024", "Satış faturası FAT-2024-001", "391", "0,00",     "2000,00", "Hesaplanan KDV"]);

  // Shading: alternate entries for readability
  [2, 3].forEach((r) => {
    ws.getRow(r).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2A44" } };
  });

  // ── Instructions sheet ─────────────────────────────────────────────────────
  const info = wb.addWorksheet("Açıklamalar");
  info.getColumn(1).width = 22;
  info.getColumn(2).width = 70;

  styleInfoHeaderRow(info.addRow(["SÜTUN", "AÇIKLAMA"]));

  const infoRows: [string, string][] = [
    ["Tarih",           "Zorunlu. GG.AA.YYYY formatında — örn: 01.01.2024. Aynı Tarih+Açıklama = 1 kayıt."],
    ["Açıklama",        "Zorunlu. Kayıt başlığı. Aynı açıklama ve tarihli satırlar tek yevmiye kaydına gruplanır."],
    ["Hesap Kodu",      "Zorunlu. TDHP hesap kodu. Örn: 102 (Banka), 120 (Alacaklar), 320 (Borçlar), 600 (Satışlar)."],
    ["Borç",            "Borç tutarı. Türk formatı: virgül ondalık ayracı. Örn: 5.000,00. Alacaksa 0,00 yazın."],
    ["Alacak",          "Alacak tutarı. Türk formatı: virgül ondalık ayracı. Örn: 5.000,00. Borçsa 0,00 yazın."],
    ["Satır Açıklaması","Satır bazında ek açıklama — isteğe bağlı."],
    ["", ""],
    ["⚠️ KURAL 1",    "Her yevmiye kaydı en az 2 satırdan oluşmalıdır (borç + alacak tarafı)."],
    ["⚠️ KURAL 2",    "Aynı Tarih + Açıklama grubu için toplam Borç = toplam Alacak olmalıdır (çift taraflı kayıt)."],
    ["⚠️ KURAL 3",    "Her satırda ya Borç ya da Alacak sıfır olmalıdır — ikisi birden dolu olamaz."],
  ];

  infoRows.forEach(([col, desc]) => {
    const row = info.addRow([col, desc]);
    if (col.startsWith("⚠️")) {
      row.font = { bold: true, color: { argb: "FFFBBF24" } };
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(buffer, "finops-yevmiye-sablonu.xlsx");
}
