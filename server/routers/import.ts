import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { clients, crewMembers } from "../../drizzle/schema";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Normalize a phone string to a consistent format */
function normalizePhone(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");
}

/** Pick the first non-empty value from a row using a list of candidate column names */
function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k]?.trim();
    if (val) return val;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Column-mapping schemas
// ---------------------------------------------------------------------------

const ClientMappingSchema = z.object({
  name: z.string(),          // column name in the CSV that maps to client name
  phone: z.string().optional(),
  email: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
});

const CrewMappingSchema = z.object({
  name: z.string(),
  phone: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

const CsvRowSchema = z.record(z.string(), z.string());

// ---------------------------------------------------------------------------
// Import router
// ---------------------------------------------------------------------------

export const importRouter = router({
  /**
   * Preview: given raw CSV rows and a column mapping, return the first 10
   * parsed records so the user can confirm before committing.
   */
  previewClients: publicProcedure
    .input(
      z.object({
        rows: z.array(CsvRowSchema).max(5000),
        mapping: ClientMappingSchema,
      })
    )
    .mutation(({ input }) => {
      const preview = input.rows.slice(0, 10).map((row) =>
        mapClientRow(row, input.mapping)
      );
      return { preview, total: input.rows.length };
    }),

  previewCrew: publicProcedure
    .input(
      z.object({
        rows: z.array(CsvRowSchema).max(1000),
        mapping: CrewMappingSchema,
      })
    )
    .mutation(({ input }) => {
      const preview = input.rows.slice(0, 10).map((row) =>
        mapCrewRow(row, input.mapping)
      );
      return { preview, total: input.rows.length };
    }),

  /**
   * Commit: bulk-insert all mapped clients.
   * Skips rows where name is empty.
   */
  importClients: publicProcedure
    .input(
      z.object({
        rows: z.array(CsvRowSchema).max(5000),
        mapping: ClientMappingSchema,
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const mapped = input.rows
        .map((row) => mapClientRow(row, input.mapping))
        .filter((r) => r.name.trim().length > 0);

      if (mapped.length === 0) {
        return { imported: 0, skipped: input.rows.length, errors: [] };
      }

      const errors: string[] = [];
      let imported = 0;

      // Insert in batches of 100
      const BATCH = 100;
      for (let i = 0; i < mapped.length; i += BATCH) {
        const batch = mapped.slice(i, i + BATCH);
        try {
          await db.insert(clients).values(
            batch.map((r) => ({
              name: r.name,
              phone: r.phone || null,
              email: r.email || null,
              addressLine1: r.addressLine1 || null,
              addressLine2: r.addressLine2 || null,
              city: r.city || null,
              state: r.state || null,
              zip: r.zip || null,
              notes: r.notes || null,
              isActive: true,
            }))
          );
          imported += batch.length;
        } catch (e: any) {
          errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${e?.message ?? "Unknown error"}`);
        }
      }

      return {
        imported,
        skipped: input.rows.length - mapped.length,
        errors,
      };
    }),

  /**
   * Commit: bulk-insert all mapped crew members.
   */
  importCrew: publicProcedure
    .input(
      z.object({
        rows: z.array(CsvRowSchema).max(1000),
        mapping: CrewMappingSchema,
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const mapped = input.rows
        .map((row) => mapCrewRow(row, input.mapping))
        .filter((r) => r.name.trim().length > 0);

      if (mapped.length === 0) {
        return { imported: 0, skipped: input.rows.length, errors: [] };
      }

      const errors: string[] = [];
      let imported = 0;

      const BATCH = 100;
      for (let i = 0; i < mapped.length; i += BATCH) {
        const batch = mapped.slice(i, i + BATCH);
        try {
          await db.insert(crewMembers).values(
            batch.map((r) => ({
              name: r.name,
              phone: r.phone || null,
              email: r.email || null,
              role: r.role || null,
              isActive: true,
            }))
          );
          imported += batch.length;
        } catch (e: any) {
          errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${e?.message ?? "Unknown error"}`);
        }
      }

      return {
        imported,
        skipped: input.rows.length - mapped.length,
        errors,
      };
    }),
});

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapClientRow(
  row: Record<string, string>,
  mapping: z.infer<typeof ClientMappingSchema>
) {
  return {
    name: pick(row, mapping.name),
    phone: normalizePhone(mapping.phone ? pick(row, mapping.phone) : ""),
    email: mapping.email ? pick(row, mapping.email) : "",
    addressLine1: mapping.addressLine1 ? pick(row, mapping.addressLine1) : "",
    addressLine2: mapping.addressLine2 ? pick(row, mapping.addressLine2) : "",
    city: mapping.city ? pick(row, mapping.city) : "",
    state: mapping.state ? pick(row, mapping.state) : "",
    zip: mapping.zip ? pick(row, mapping.zip) : "",
    notes: mapping.notes ? pick(row, mapping.notes) : "",
  };
}

function mapCrewRow(
  row: Record<string, string>,
  mapping: z.infer<typeof CrewMappingSchema>
) {
  return {
    name: pick(row, mapping.name),
    phone: normalizePhone(mapping.phone ? pick(row, mapping.phone) : ""),
    email: mapping.email ? pick(row, mapping.email) : "",
    role: mapping.role ? pick(row, mapping.role) : "",
  };
}
