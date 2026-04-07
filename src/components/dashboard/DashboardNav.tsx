/**
 * TopBar — Slim top navigation bar.
 *
 * Responsibilities:
 *  - FinOPS brand logo (links to /dashboard)
 *  - Clerk OrganizationSwitcher
 *  - Clerk UserButton
 *
 * Navigation links have been moved to the Sidebar component.
 */
"use client";
import React from "react";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export function DashboardNav() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1.25rem",
        height: "52px",
        backgroundColor: "#080f1f",
        borderBottom: "1px solid #1e293b",
        position: "sticky",
        top: 0,
        zIndex: 20,
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <a
        href="/dashboard"
        style={{
          fontSize: "1.1875rem",
          fontWeight: 800,
          color: "#38bdf8",
          textDecoration: "none",
          letterSpacing: "-0.03em",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        Fin<span style={{ color: "#e2e8f0" }}>OPS</span>
      </a>

      {/* Right: Org Switcher + User */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <OrganizationSwitcher
          appearance={{
            baseTheme: dark,
            variables: {
              colorBackground: "#1e293b",
              colorText: "#e2e8f0",
              colorTextSecondary: "#cbd5e1",
              colorNeutral: "#94a3b8",
            },
            elements: {
              organizationSwitcherTrigger: {
                color: "#e2e8f0",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.375rem",
              },
              organizationSwitcherPopoverCard: {
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              },
              organizationPreviewMainIdentifier: { color: "#e2e8f0", opacity: 1 },
              organizationPreviewSecondaryIdentifier: { color: "#94a3b8", opacity: 1 },
              organizationSwitcherPopoverActionButton__createOrganization: { color: "#e2e8f0", opacity: 1 },
              organizationSwitcherPopoverActionButtonText: { color: "#e2e8f0", opacity: 1 },
              organizationSwitcherPopoverActionButtonIcon: { color: "#94a3b8", opacity: 1 },
              organizationSwitcherPreviewButton: { color: "#e2e8f0", opacity: 1 },
              organizationSwitcherPopoverFooter: { borderTop: "1px solid #334155" },
            },
          }}
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
          createOrganizationMode="modal"
        />
        <UserButton appearance={{ baseTheme: dark }} />
      </div>
    </header>
  );
}
