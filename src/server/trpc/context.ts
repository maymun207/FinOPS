import "server-only";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { companies } from "@/server/db/schema";

/**
 * tRPC context — created per request.
 *
 * Resolves the authenticated user's company from Clerk orgId → companies table.
 * Exposes:
 *   - db: Drizzle client
 *   - userId: Clerk user ID (null if unauthenticated)
 *   - orgId: Clerk organization ID (null if no org selected)
 *   - companyId: resolved company UUID (null if no company found)
 *   - headers: request headers
 */
export async function createTRPCContext(opts: { headers: Headers }) {
  const { userId, orgId } = await auth();

  let companyId: string | null = null;

  // Resolve company from Clerk orgId if authenticated with an org
  if (orgId) {
    const company = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.clerkOrgId, orgId))
      .limit(1);

    companyId = company[0]?.id ?? null;
  }

  return {
    db,
    userId,
    orgId,
    companyId,
    ...opts,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
