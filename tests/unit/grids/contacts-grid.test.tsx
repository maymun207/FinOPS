/**
 * @vitest-environment jsdom
 *
 * Unit tests: ContactsGrid renders AG Grid contact list without errors.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactsGrid, type ContactRow } from "@/components/grids/ContactsGrid";

const SAMPLE_CONTACTS: ContactRow[] = [
  {
    id: "c1",
    name: "ABC Ltd. Şti.",
    type: "customer",
    taxId: "1234567890",
    email: "info@abc.com",
    phone: "+90 212 000 0000",
    address: "Istanbul",
    createdAt: new Date("2026-01-01"),
  },
  {
    id: "c2",
    name: "XYZ Tedarik A.Ş.",
    type: "vendor",
    taxId: "9876543210",
    email: "info@xyz.com",
    phone: "+90 312 000 0000",
    address: "Ankara",
    createdAt: new Date("2026-02-01"),
  },
  {
    id: "c3",
    name: "Çift Taraflı Tic.",
    type: "both",
    taxId: null,
    email: null,
    phone: null,
    address: null,
    createdAt: new Date("2026-03-01"),
  },
];

describe("ContactsGrid — render tests", () => {
  it("renders without error with empty dataset", () => {
    const { container } = render(
      <ContactsGrid rows={[]} />
    );
    expect(container).toBeDefined();
  });

  it("renders with 3 contacts, shows correct row count", async () => {
    const { container } = render(
      <ContactsGrid rows={SAMPLE_CONTACTS} height="400px" />
    );

    // AG Grid should mount and create ag-root-wrapper
    const gridWrapper = container.querySelector(".ag-root-wrapper");
    expect(gridWrapper).toBeTruthy();

    // AG Grid renders rows asynchronously, wait briefly
    await new Promise((r) => setTimeout(r, 200));

    // AG Grid duplicates .ag-row DOM nodes for pinned columns (left/center/right).
    // Count unique row-ids to get the actual data row count.
    const allRows = container.querySelectorAll(".ag-row");
    const uniqueRowIds = new Set<string>();
    allRows.forEach((row) => {
      const rowId = row.getAttribute("row-id");
      if (rowId) uniqueRowIds.add(rowId);
    });
    expect(uniqueRowIds.size).toBe(3);
  });
});
