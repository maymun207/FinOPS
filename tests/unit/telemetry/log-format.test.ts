/**
 * log-format.test.ts — Validates FinOpsLog structured format.
 *
 * Test cases:
 *   1. All required fields are present in every log entry
 *   2. Duration is always a number in milliseconds, never a string
 *   3. Error field contains the error message string, not an Error object
 */
import { describe, it, expect } from "vitest";
import { createLog, type FinOpsLog } from "@/lib/telemetry/axiom";

describe("FinOpsLog structured format", () => {
  it("all required fields are present in every log entry", () => {
    const entry = createLog({
      service: "api",
      level: "info",
      operation: "invoice.create",
      company_id: "company-123",
      user_id: "user-456",
      duration_ms: 42,
      metadata: { hello: "world" },
    });

    // Required fields
    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("service");
    expect(entry).toHaveProperty("level");
    expect(entry).toHaveProperty("operation");

    // Timestamp is ISO 8601
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // Service is a valid value
    expect(["api", "trigger-job", "duckdb", "gib"]).toContain(entry.service);

    // Level is a valid value
    expect(["info", "warn", "error"]).toContain(entry.level);

    // Operation is a string
    expect(typeof entry.operation).toBe("string");
    expect(entry.operation.length).toBeGreaterThan(0);
  });

  it("duration is always a number in milliseconds, never a string", () => {
    const entry = createLog({
      service: "api",
      level: "info",
      operation: "journal.create",
      duration_ms: 150,
    });

    expect(typeof entry.duration_ms).toBe("number");
    expect(entry.duration_ms).toBe(150);
    expect(entry.duration_ms).toBeGreaterThanOrEqual(0);

    // Verify it's not accidentally stringified
    expect(entry.duration_ms).not.toBe("150");
  });

  it("error field contains the error message string, not an Error object", () => {
    // Simulate what logTimed does with an error
    const originalError = new Error("Something went wrong");
    const errorMessage = originalError.message;

    const entry = createLog({
      service: "api",
      level: "error",
      operation: "invoice.delete",
      error: errorMessage,
    });

    // Error should be a plain string
    expect(typeof entry.error).toBe("string");
    expect(entry.error).toBe("Something went wrong");

    // It should NOT be an Error object
    expect(entry.error).not.toBeInstanceOf(Error);
    expect(entry.error).not.toHaveProperty("stack");
    expect(entry.error).not.toHaveProperty("name");
  });

  it("optional fields are undefined when not provided", () => {
    const minimal = createLog({
      service: "trigger-job",
      level: "info",
      operation: "sync.duckdb",
    });

    expect(minimal.company_id).toBeUndefined();
    expect(minimal.user_id).toBeUndefined();
    expect(minimal.duration_ms).toBeUndefined();
    expect(minimal.error).toBeUndefined();
    expect(minimal.metadata).toBeUndefined();
  });

  it("timestamp auto-generates when not provided", () => {
    const before = Date.now();
    const entry = createLog({
      service: "gib",
      level: "info",
      operation: "gib.submit",
    });
    const after = Date.now();

    const entryTime = new Date(entry.timestamp).getTime();
    expect(entryTime).toBeGreaterThanOrEqual(before);
    expect(entryTime).toBeLessThanOrEqual(after);
  });

  it("custom timestamp is preserved when provided", () => {
    const customTs = "2024-01-15T10:30:00.000Z";
    const entry = createLog({
      service: "api",
      level: "warn",
      operation: "rate-limit",
      timestamp: customTs,
    });

    expect(entry.timestamp).toBe(customTs);
  });
});
