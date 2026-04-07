/**
 * Sidebar — collapsible left navigation for FinOPS dashboard.
 *
 * Features:
 *  - Smooth expand/collapse (240px ↔ 64px)
 *  - Collapsed state persisted in localStorage
 *  - Active route detection via usePathname()
 *  - Icons always visible; labels + section headers hidden when collapsed
 *  - Tooltip on hover when collapsed
 *  - Covers all 10 nav destinations in 5 logical sections
 */
"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const EXPANDED_W = 240;
const COLLAPSED_W = 64;
const STORAGE_KEY = "finops-sidebar-collapsed";

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    matchPrefix?: string; // highlight for nested routes
}

interface NavSection {
    title: string;
    items: NavItem[];
}

// ─── SVG icon primitives ───────────────────────────────────────────────────
const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
    >
        <path d={d} />
    </svg>
);

const Icons = {
    dashboard: (
        <Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
    ),
    invoice: (
        <>
            <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <Icon d="M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
        </>
    ),
    ledger: (
        <Icon d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20 M9 10h6 M9 14h4" />
    ),
    contacts: (
        <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />
    ),
    reports: (
        <Icon d="M18 20V10 M12 20V4 M6 20v-6" />
    ),
    import: (
        <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
    ),
    cfo: (
        <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 8v4l3 3" />
    ),
    settings: (
        <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    ),
    periods: (
        <Icon d="M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01" />
    ),
    audit: (
        <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 15l2 2 4-4" />
    ),
    chevronLeft: (
        <Icon d="M15 18l-6-6 6-6" size={16} />
    ),
    chevronRight: (
        <Icon d="M9 18l6-6-6-6" size={16} />
    ),
};

const NAV_SECTIONS: NavSection[] = [
    {
        title: "GENEL",
        items: [
            { label: "Pano", href: "/dashboard", icon: Icons.dashboard },
        ],
    },
    {
        title: "MUHASEBE",
        items: [
            { label: "Faturalar", href: "/invoices", icon: Icons.invoice, matchPrefix: "/invoices" },
            { label: "Yevmiye Defteri", href: "/ledger", icon: Icons.ledger },
        ],
    },
    {
        title: "CARİLER",
        items: [
            { label: "Cari Kartlar", href: "/contacts", icon: Icons.contacts, matchPrefix: "/contacts" },
        ],
    },
    {
        title: "RAPORLAR",
        items: [
            { label: "Raporlar", href: "/reports", icon: Icons.reports },
        ],
    },
    {
        title: "ARAÇLAR",
        items: [
            { label: "İçe Aktarım", href: "/import", icon: Icons.import, matchPrefix: "/import" },
            { label: "AI Mali Müşavir", href: "/cfo", icon: Icons.cfo },
        ],
    },
    {
        title: "AYARLAR",
        items: [
            { label: "Genel Ayarlar", href: "/settings", icon: Icons.settings },
            { label: "Mali Dönemler", href: "/settings/periods", icon: Icons.periods },
        ],
    },
    {
        title: "YÖNETİM",
        items: [
            { label: "Denetim Kayıtları", href: "/admin/audit", icon: Icons.audit },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Hydrate from localStorage after mount (avoid SSR mismatch)
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "true") setCollapsed(true);
        setMounted(true);
    }, []);

    const toggle = () => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem(STORAGE_KEY, String(next));
            return next;
        });
    };

    const isActive = (item: NavItem) => {
        const prefix = item.matchPrefix ?? item.href;
        if (prefix === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(prefix);
    };

    const width = mounted ? (collapsed ? COLLAPSED_W : EXPANDED_W) : EXPANDED_W;

    return (
        <aside
            style={{
                width,
                minWidth: width,
                maxWidth: width,
                height: "100%",
                backgroundColor: "#080f1f",
                borderRight: "1px solid #1e293b",
                display: "flex",
                flexDirection: "column",
                transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1), max-width 0.22s cubic-bezier(0.4,0,0.2,1)",
                overflow: "hidden",
                position: "relative",
                zIndex: 10,
            }}
        >
            {/* Navigation */}
            <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0.75rem 0" }}>
                {NAV_SECTIONS.map((section) => (
                    <div key={section.title} style={{ marginBottom: "0.25rem" }}>
                        {/* Section title */}
                        {!collapsed && (
                            <div style={{
                                padding: "0.5rem 1rem 0.25rem",
                                fontSize: "0.625rem",
                                fontWeight: 700,
                                letterSpacing: "0.1em",
                                color: "#334155",
                                textTransform: "uppercase",
                                whiteSpace: "nowrap",
                                userSelect: "none",
                            }}>
                                {section.title}
                            </div>
                        )}
                        {collapsed && <div style={{ height: "0.5rem" }} />}

                        {/* Nav items */}
                        {section.items.map((item) => {
                            const active = isActive(item);
                            return (
                                <a
                                    key={item.href}
                                    href={item.href}
                                    title={collapsed ? item.label : undefined}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.75rem",
                                        padding: "0 0.75rem",
                                        height: "40px",
                                        margin: "1px 0.5rem",
                                        borderRadius: "0.5rem",
                                        textDecoration: "none",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        transition: "background-color 0.15s, color 0.15s",
                                        borderLeft: active ? "3px solid #38bdf8" : "3px solid transparent",
                                        backgroundColor: active ? "#0f2444" : "transparent",
                                        color: active ? "#e2e8f0" : "#64748b",
                                        fontSize: "0.8125rem",
                                        fontWeight: active ? 600 : 400,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.backgroundColor = "#1e293b";
                                            e.currentTarget.style.color = "#cbd5e1";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.backgroundColor = "transparent";
                                            e.currentTarget.style.color = "#64748b";
                                        }
                                    }}
                                >
                                    <span style={{
                                        color: active ? "#38bdf8" : "inherit",
                                        display: "flex",
                                        alignItems: "center",
                                        flexShrink: 0,
                                    }}>
                                        {item.icon}
                                    </span>
                                    {!collapsed && (
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {item.label}
                                        </span>
                                    )}
                                </a>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Collapse toggle button */}
            <button
                onClick={toggle}
                title={collapsed ? "Genişlet" : "Daralt"}
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: collapsed ? "center" : "flex-end",
                    gap: "0.5rem",
                    width: "100%",
                    padding: "0.875rem 1rem",
                    backgroundColor: "transparent",
                    border: "none",
                    borderTop: "1px solid #1e293b",
                    color: "#475569",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    transition: "color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#94a3b8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#475569"; }}
            >
                {!collapsed && (
                    <span style={{ fontSize: "0.6875rem", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                        Daralt
                    </span>
                )}
                {collapsed ? Icons.chevronRight : Icons.chevronLeft}
            </button>
        </aside>
    );
}
