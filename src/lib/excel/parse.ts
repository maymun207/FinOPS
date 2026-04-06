/**
 * SheetJS Excel/CSV parse utility.
 *
 * Pure function: takes an ArrayBuffer → returns structured sheet data.
 * No side effects, no DOM access, can run in browser or Node.
 */
import * as XLSX from "xlsx";

export interface ParsedSheet {
  /** Sheet name */
  name: string;
  /** Column headers (first row) */
  headers: string[];
  /** Data rows as key-value objects (header → cell value) */
  rows: Record<string, unknown>[];
}

export interface ParseResult {
  /** All sheets parsed from the workbook */
  sheets: ParsedSheet[];
  /** Total row count across all sheets */
  totalRows: number;
  /** File metadata */
  meta: {
    sheetCount: number;
    fileName?: string;
  };
}

/**
 * Parse an Excel or CSV file from an ArrayBuffer.
 *
 * @param buffer - The file contents as ArrayBuffer
 * @param fileName - Optional file name for metadata
 * @returns ParseResult with all sheets, headers, and rows
 */
export function parseExcelBuffer(
  buffer: ArrayBuffer,
  fileName?: string
): ParseResult {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,    // Keep dates as serial numbers for our parser
    cellNF: false,       // Don't parse number formats
    cellText: false,     // Don't generate text representations
    raw: true,           // Return raw values (not formatted)
  });

  let totalRows = 0;
  const sheets: ParsedSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName]!;

    // Convert to JSON with header row → key mapping
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: "",        // Default empty cells to ""
      raw: true,         // Return raw values
    });

    // Extract headers from the first row keys, or from the sheet range
    const headers =
      rawRows.length > 0
        ? Object.keys(rawRows[0]!)
        : getHeadersFromRange(ws);

    totalRows += rawRows.length;

    sheets.push({
      name: sheetName,
      headers,
      rows: rawRows,
    });
  }

  return {
    sheets,
    totalRows,
    meta: {
      sheetCount: workbook.SheetNames.length,
      fileName,
    },
  };
}

/**
 * Extract headers from sheet range when no data rows exist.
 */
function getHeadersFromRange(ws: XLSX.WorkSheet): string[] {
  const ref = ws["!ref"];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const headers: string[] = [];

  for (let col = range.s.c; col <= range.e.c; col++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = ws[addr] as { v?: unknown } | undefined;
    headers.push(cell?.v != null ? String(cell.v as string | number) : `Column ${String(col + 1)}`);
  }

  return headers;
}

/**
 * Parse a File object (browser). Reads File as ArrayBuffer, then parses.
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  return parseExcelBuffer(buffer, file.name);
}
