/**
 * Column name fingerprinting for mapping profile auto-matching.
 *
 * Generates a SHA-256 hash of the sorted, normalized column names
 * from an uploaded file. This fingerprint is stored with the mapping
 * profile and used to auto-detect the same file format on re-upload.
 *
 * Pure function, no side effects.
 */

/**
 * Generate a SHA-256 fingerprint from an array of column names.
 *
 * Steps:
 *   1. Normalize: trim, lowercase
 *   2. Sort alphabetically (locale-independent)
 *   3. Join with pipe separator
 *   4. SHA-256 hash → hex string
 *
 * @param columns - The column header names from the uploaded file
 * @returns Promise<string> — hex-encoded SHA-256 hash
 */
export async function generateColumnFingerprint(
  columns: string[]
): Promise<string> {
  if (columns.length === 0) {
    return "empty";
  }

  // Normalize and sort
  const normalized = columns
    .map((col) => col.trim().toLowerCase())
    .sort();

  // Join with pipe separator
  const payload = normalized.join("|");

  // SHA-256 hash (works in browser via Web Crypto API and in Node via globalThis.crypto)
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Synchronous fingerprint for Node.js (test environments).
 * Uses the same normalization logic but node:crypto for hashing.
 */
export function generateColumnFingerprintSync(columns: string[]): string {
  if (columns.length === 0) {
    return "empty";
  }

  const normalized = columns
    .map((col) => col.trim().toLowerCase())
    .sort();

  const payload = normalized.join("|");

  // Use node:crypto if available, otherwise fallback to simple hash
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require("node:crypto");
    return crypto.createHash("sha256").update(payload).digest("hex");
  } catch {
    // Fallback: simple string hash (not cryptographic, for tests only)
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
  }
}
