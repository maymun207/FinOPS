import React from "react";

/**
 * Auth layout — minimal centered layout for sign-in/sign-up pages.
 * No sidebar, no nav — just the auth form centered.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      }}
    >
      {children}
    </main>
  );
}
