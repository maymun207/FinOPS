"use client";

/**
 * Ledger Page — /dashboard/ledger
 *
 * Displays the journal entry grid (Yevmiye Defteri) with:
 *   - AG Grid with Turkish locale
 *   - TRY currency formatting
 *   - Balance indicator
 *   - tRPC data fetching
 */
import React from "react";
import { trpc } from "@/lib/trpc/client";
import { JournalEntryGrid } from "@/components/grids/JournalEntryGrid";
import type { JournalEntryRow } from "@/components/grids/JournalEntryGrid";

export default function LedgerPage() {
  const { data, isLoading } = trpc.journal.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Transform tRPC data to JournalEntryRow format
  const rows: JournalEntryRow[] = React.useMemo(() => {
    if (!data) return [];
    return data.map((row) => ({
      id: row.id,
      entryDate: row.entryDate,
      entryDescription: row.entryDescription,
      accountCode: row.accountCode,
      accountName: row.accountName,
      debitAmount: Number(row.debitAmount),
      creditAmount: Number(row.creditAmount),
      lineDescription: row.lineDescription,
      sourceType: row.sourceType,
    }));
  }, [data]);

  return (
    <div
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        height: "calc(100vh - 4rem)",
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#e2e8f0",
              margin: 0,
            }}
          >
            Yevmiye Defteri
          </h1>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "0.875rem",
              margin: "0.25rem 0 0 0",
            }}
          >
            Muhasebe kayıtlarını görüntüleyin ve yönetin
          </p>
        </div>

        {data && (
          <span
            style={{
              color: "#64748b",
              fontSize: "0.75rem",
              fontFamily: "monospace",
            }}
          >
            {rows.length} satır
          </span>
        )}
      </div>

      {/* Journal entry grid */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <JournalEntryGrid
          rows={rows}
          loading={isLoading}
          height="100%"
        />
      </div>
    </div>
  );
}
