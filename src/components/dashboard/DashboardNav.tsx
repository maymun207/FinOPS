"use client";

import React from "react";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

/**
 * DashboardNav — Top navigation bar for the dashboard.
 *
 * Contains:
 *   - Logo / brand name
 *   - Navigation links
 *   - Clerk OrganizationSwitcher (create/switch orgs)
 *   - Clerk UserButton (profile, sign out)
 */
export function DashboardNav() {
  const navLinks = [
    { label: "Pano", href: "/dashboard" },
    { label: "Faturalar", href: "/invoices" },
    { label: "Cariler", href: "/contacts" },
    { label: "Yevmiye", href: "/ledger" },
    { label: "Raporlar", href: "/reports" },
    { label: "Ayarlar", href: "/settings" },
  ];

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.5rem",
        backgroundColor: "#1e293b",
        borderBottom: "1px solid #334155",
      }}
    >
      {/* Left: Logo + Nav */}
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <a
          href="/dashboard"
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            color: "#38bdf8",
            textDecoration: "none",
            letterSpacing: "-0.025em",
          }}
        >
          FinOPS
        </a>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                color: "#94a3b8",
                fontSize: "0.8125rem",
                fontWeight: 500,
                textDecoration: "none",
                padding: "0.375rem 0.75rem",
                borderRadius: "0.375rem",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#e2e8f0";
                e.currentTarget.style.backgroundColor = "#334155";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* Right: Org Switcher + User */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
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
              // Trigger button in nav
              organizationSwitcherTrigger: {
                color: "#e2e8f0",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.375rem",
              },
              // Popup card container
              organizationSwitcherPopoverCard: {
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              },
              // Org name text (e.g. "Test Sirketi")
              organizationPreviewMainIdentifier: {
                color: "#e2e8f0",
                opacity: 1,
              },
              // Role text (e.g. "Admin")
              organizationPreviewSecondaryIdentifier: {
                color: "#94a3b8",
                opacity: 1,
              },
              // "Create organization" button text
              organizationSwitcherPopoverActionButton__createOrganization: {
                color: "#e2e8f0",
                opacity: 1,
              },
              organizationSwitcherPopoverActionButtonText: {
                color: "#e2e8f0",
                opacity: 1,
              },
              organizationSwitcherPopoverActionButtonIcon: {
                color: "#94a3b8",
                opacity: 1,
              },
              // "Manage" button
              organizationSwitcherPreviewButton: {
                color: "#e2e8f0",
                opacity: 1,
              },
              // Footer "Secured by Clerk"
              organizationSwitcherPopoverFooter: {
                borderTop: "1px solid #334155",
              },
            },
          }}
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
          createOrganizationMode="modal"
        />
        <UserButton
          appearance={{ baseTheme: dark }}
        />
      </div>
    </nav>
  );
}
