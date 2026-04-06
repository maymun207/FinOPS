import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { companies } from "@/server/db/schema";

/**
 * tRPC context — created per request.
 *
 * Resolves the authenticated user's company from Clerk orgId → companies table.
 * Auto-provisions a company row if orgId exists but no company is found.
 *
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
    const existing = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.clerkOrgId, orgId))
      .limit(1);

    if (existing[0]) {
      companyId = existing[0].id;
    } else {
      // Auto-provision: create a company row for this Clerk org
      try {
        const clerk = await clerkClient();
        const org = await clerk.organizations.getOrganization({ organizationId: orgId });
        const inserted = await db
          .insert(companies)
          .values({
            clerkOrgId: orgId,
            name: org.name || "Yeni Şirket",
          })
          .returning({ id: companies.id });

        companyId = inserted[0]?.id ?? null;
        console.log(`✅ Auto-provisioned company for org ${orgId}: ${companyId}`);
      } catch (err) {
        console.error("❌ Failed to auto-provision company:", err);
      }
    }
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

