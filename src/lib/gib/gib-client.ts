/**
 * gib-client — GIB API HTTP client (intermediary/mock pattern).
 *
 * Designed for easy swap to a real intermediary (Logo e-Transformation,
 * Mikro, Paraşüt, etc). The interface stays the same; only the transport
 * implementation changes.
 *
 * Current mode: MOCK — simulates a 2-second processing delay and returns
 * ACCEPTED for all submissions. Set GIB_MODE=sandbox env var if available.
 */

// ── Response types ──────────────────────────────────────────────────

export type GIBStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface GIBSubmitResponse {
  /** Whether the submission was received successfully */
  success: boolean;
  /** ETTN returned by GIB (Electronic Commerce Tracking Number) */
  ettn: string;
  /** Initial status — usually PENDING for async processing */
  status: GIBStatus;
  /** Error message if submission failed */
  errorMessage?: string;
}

export interface GIBStatusResponse {
  /** Current processing status */
  status: GIBStatus;
  /** Rejection reason (if REJECTED) */
  rejectionReason?: string;
  /** Timestamp of status change */
  statusDate: string;
}

// ── Client interface ────────────────────────────────────────────────

export interface IGIBClient {
  submitInvoice(xml: string): Promise<GIBSubmitResponse>;
  checkStatus(ettn: string): Promise<GIBStatusResponse>;
}

// ── Mock implementation ─────────────────────────────────────────────

/**
 * MockGIBClient — simulates GIB intermediary behavior.
 *
 * - submitInvoice: 2s delay → returns PENDING with a generated ETTN
 * - checkStatus: returns ACCEPTED immediately (simulating fast processing)
 *
 * In production, replace this with the real intermediary SDK/HTTP calls.
 */
export class MockGIBClient implements IGIBClient {
  async submitInvoice(xml: string): Promise<GIBSubmitResponse> {
    // Validate XML is not empty
    if (!xml || xml.trim().length === 0) {
      return {
        success: false,
        ettn: "",
        status: "REJECTED",
        errorMessage: "Boş XML gönderildi",
      };
    }

    // Simulate network + processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate a mock ETTN (UUID v4-like format)
    const ettn = crypto.randomUUID();

    return {
      success: true,
      ettn,
      status: "PENDING",
    };
  }

  async checkStatus(ettn: string): Promise<GIBStatusResponse> {
    if (!ettn) {
      return {
        status: "REJECTED",
        rejectionReason: "Geçersiz ETTN",
        statusDate: new Date().toISOString(),
      };
    }

    // Simulate polling — mock always returns ACCEPTED
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      status: "ACCEPTED",
      statusDate: new Date().toISOString(),
    };
  }
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create a GIB client instance.
 *
 * Currently returns MockGIBClient. When a real intermediary is configured,
 * this factory will return the appropriate client based on env vars.
 */
export function createGIBClient(): IGIBClient {
  // TODO: Check env vars for real intermediary configuration
  // if (process.env.GIB_INTERMEDIARY === 'logo') return new LogoGIBClient();
  // if (process.env.GIB_INTERMEDIARY === 'mikro') return new MikroGIBClient();
  return new MockGIBClient();
}
