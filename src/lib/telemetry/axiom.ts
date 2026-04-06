/**
 * axiom — Structured log client for FinOPS.
 *
 * Every log entry follows the FinOpsLog schema:
 *   { timestamp, service, level, operation, company_id?, user_id?, duration_ms?, error?, metadata? }
 *
 * Uses @axiomhq/js for batched ingestion.
 * Falls back to console.log when AXIOM_TOKEN is not set (dev mode).
 */

// ── Structured log interface ────────────────────────────────────────

export type FinOpsService = "api" | "trigger-job" | "duckdb" | "gib";
export type FinOpsLevel = "info" | "warn" | "error";

export interface FinOpsLog {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Service that generated the log */
  service: FinOpsService;
  /** Log level */
  level: FinOpsLevel;
  /** Company ID when available */
  company_id?: string;
  /** User ID when available */
  user_id?: string;
  /** Operation name (e.g., 'invoice.create', 'import.quarantine.approve') */
  operation: string;
  /** Duration in milliseconds for timed operations */
  duration_ms?: number;
  /** Error message string (NOT an Error object) */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ── Dataset name ────────────────────────────────────────────────────

const AXIOM_DATASET = "finops-production";

// ── Log buffer (no external deps at import time) ────────────────────

let axiomClient: { ingest: (dataset: string, events: FinOpsLog[]) => void; flush: () => Promise<void> } | null = null;
let initAttempted = false;

async function getAxiomClient() {
  if (initAttempted) return axiomClient;
  initAttempted = true;

  const token = process.env.AXIOM_TOKEN;
  if (!token) {
    console.warn("[axiom] AXIOM_TOKEN not set — logs will only go to console");
    return null;
  }

  try {
    const { Axiom } = await import("@axiomhq/js");
    axiomClient = new Axiom({ token });
    return axiomClient;
  } catch {
    console.warn("[axiom] Failed to initialize Axiom client");
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Create a new structured log entry.
 *
 * @param entry - Log fields (timestamp auto-added if missing)
 */
export function createLog(entry: Omit<FinOpsLog, "timestamp"> & { timestamp?: string }): FinOpsLog {
  return {
    timestamp: entry.timestamp ?? new Date().toISOString(),
    ...entry,
  } as FinOpsLog;
}

/**
 * Send a log entry to Axiom (or console in dev mode).
 */
export async function log(entry: Omit<FinOpsLog, "timestamp"> & { timestamp?: string }): Promise<void> {
  const logEntry = createLog(entry);

  // Always log to console in dev
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    const prefix = `[${logEntry.service}] [${logEntry.level}]`;
    if (logEntry.level === "error") {
      console.error(prefix, logEntry.operation, logEntry.error, logEntry.metadata);
    } else {
      console.log(prefix, logEntry.operation, logEntry.duration_ms ? `${logEntry.duration_ms}ms` : "", logEntry.metadata ?? "");
    }
  }

  // Send to Axiom
  const client = await getAxiomClient();
  if (client) {
    client.ingest(AXIOM_DATASET, [logEntry]);
  }
}

/**
 * Flush all buffered logs to Axiom.
 * Call this on process exit / request end.
 */
export async function flushLogs(): Promise<void> {
  const client = await getAxiomClient();
  if (client) {
    await client.flush();
  }
}

/**
 * Helper: time an async operation and log it.
 *
 * @returns The result of the operation
 */
export async function logTimed<T>(
  opts: {
    service: FinOpsService;
    operation: string;
    company_id?: string;
    user_id?: string;
    metadata?: Record<string, unknown>;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await log({
      service: opts.service,
      level: "info",
      operation: opts.operation,
      company_id: opts.company_id,
      user_id: opts.user_id,
      duration_ms: Date.now() - start,
      metadata: opts.metadata,
    });
    return result;
  } catch (err) {
    await log({
      service: opts.service,
      level: "error",
      operation: opts.operation,
      company_id: opts.company_id,
      user_id: opts.user_id,
      duration_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      metadata: opts.metadata,
    });
    throw err;
  }
}
