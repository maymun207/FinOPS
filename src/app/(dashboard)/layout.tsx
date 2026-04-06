import React from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

/**
 * Dashboard layout — protected route group.
 *
 * Redirects unauthenticated users to /sign-in.
 * This is a server component that checks auth on each request.
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
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <DashboardNav />
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
            Devam etmek için üst menüden bir organizasyon oluşturun veya mevcut
            bir organizasyona geçiş yapın.
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
