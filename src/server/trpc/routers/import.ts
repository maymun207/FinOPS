import "server-only";
import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { importQuarantine } from "../../db/schema/import-quarantine";
import { columnMappingProfiles } from "../../db/schema/column-mapping-profiles";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { invoiceImportRowSchema } from "@/lib/schemas/invoice-import.schema";
import { contactImportRowSchema } from "@/lib/schemas/contact-import.schema";
import { journalImportRowSchema } from "@/lib/schemas/journal-import.schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SCHEMA_MAP: Record<string, z.ZodTypeAny> = {
  invoice: invoiceImportRowSchema,
  contact: contactImportRowSchema,
  journal: journalImportRowSchema,
};

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

      // Get the Zod schema for this import type
      const schema = SCHEMA_MAP[input.importType];

      // Build quarantine records with Zod pre-validation
      const records = input.rows.map((row) => {
        let errorMessage: string | null = null;

        // Validate each row — store errors but still queue for review
        if (schema) {
          const result = schema.safeParse(row);
          if (!result.success) {
            errorMessage = result.error.issues
              .map((i: { path: (string | number)[]; message: string }) =>
                `${i.path.join(".")}: ${i.message}`
              )
              .join("; ");
          }
        }

        return {
          companyId: ctx.companyId,
          source: input.source,
          importType: input.importType,
          rawData: row,
          status: "pending" as const,
          errorMessage,
          mappingProfileId: input.mappingProfileId ?? null,
        };
      });

      // Batch insert into quarantine
      const inserted = await ctx.db
        .insert(importQuarantine)
        .values(records)
        .returning({ id: importQuarantine.id });

      const errorCount = records.filter((r) => r.errorMessage).length;

      return {
        queued: inserted.length,
        importType: input.importType,
        validCount: inserted.length - errorCount,
        errorCount,
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
