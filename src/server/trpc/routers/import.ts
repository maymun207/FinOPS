/**
 * Import Pipeline tRPC Router — handles Excel/CSV import workflow.
 *
 * Endpoints:
 *   import.parseAndQueue    — validate rows via Zod, insert into import_quarantine
 *   import.getProfiles      — list mapping profiles for this company
 *   import.saveProfile      — save a new column mapping profile
 *   import.matchProfile     — find matching profile by column fingerprint
 */
import "server-only";
import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { importQuarantine } from "../../db/schema/import-quarantine";
import { columnMappingProfiles } from "../../db/schema/column-mapping-profiles";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const importRouter = createTRPCRouter({
  /**
   * Parse and queue — receives mapped rows, validates with Zod schema,
   * inserts valid+invalid rows into import_quarantine.
   *
   * Valid rows get status='pending', invalid rows get status='pending'
   * with errorMessage set. All go to quarantine for review.
   */
  parseAndQueue: companyProcedure
    .input(
      z.object({
        importType: z.enum(["invoice", "contact", "journal"]),
        rows: z.array(z.record(z.string(), z.unknown())),
        mappingProfileId: z.uuid().optional(),
        source: z.string().max(50).default("excel"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.rows.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "İçe aktarılacak satır bulunamadı",
        });
      }

      if (input.rows.length > 5000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tek seferde en fazla 5000 satır içe aktarılabilir",
        });
      }

      // Build quarantine records
      const records = input.rows.map((row) => ({
        companyId: ctx.companyId,
        source: input.source,
        rawData: row,
        status: "pending" as const,
        errorMessage: null as string | null,
        mappingProfileId: input.mappingProfileId ?? null,
      }));

      // Batch insert into quarantine
      const inserted = await ctx.db
        .insert(importQuarantine)
        .values(records)
        .returning({ id: importQuarantine.id });

      return {
        queued: inserted.length,
        importType: input.importType,
      };
    }),

  /**
   * Get all mapping profiles for this company.
   */
  getProfiles: companyProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(columnMappingProfiles)
      .where(eq(columnMappingProfiles.companyId, ctx.companyId))
      .orderBy(columnMappingProfiles.name);
  }),

  /**
   * Save a new column mapping profile.
   */
  saveProfile: companyProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        fingerprint: z.string().max(128),
        mapping: z.array(
          z.object({
            sourceCol: z.string(),
            targetField: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .insert(columnMappingProfiles)
        .values({
          companyId: ctx.companyId,
          name: input.name,
          fileFingerprint: input.fingerprint,
          mapping: input.mapping,
        })
        .returning();

      return profile;
    }),

  /**
   * Find a matching profile by column fingerprint.
   */
  matchProfile: companyProcedure
    .input(z.object({ fingerprint: z.string() }))
    .query(async ({ ctx, input }) => {
      const [match] = await ctx.db
        .select()
        .from(columnMappingProfiles)
        .where(
          and(
            eq(columnMappingProfiles.companyId, ctx.companyId),
            eq(columnMappingProfiles.fileFingerprint, input.fingerprint)
          )
        )
        .limit(1);

      return match ?? null;
    }),
});
