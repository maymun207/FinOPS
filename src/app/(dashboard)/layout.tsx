import React from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { Sidebar } from "@/components/layout/Sidebar";

/**
 * Dashboard layout — protected route group.
 *
 * Structure:
 *   TopBar (fixed header)
 *   └─ flex row
 *      ├─ Sidebar (collapsible left nav)
 *      └─ main (scrollable page content)
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <DashboardNav />

      {/* Body: Sidebar + Content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar />

        {/* Main scrollable content */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            backgroundColor: "#0f172a",
          }}
        >
          {!orgId ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "80vh",
                gap: "1.5rem",
                padding: "2rem",
              }}
            >
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e2e8f0" }}>
                Organizasyon Seçin
              </h2>
              <p style={{ color: "#94a3b8", textAlign: "center", maxWidth: "400px" }}>
                Devam etmek için üst menüden bir organizasyon oluşturun veya
                mevcut bir organizasyona geçiş yapın.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
