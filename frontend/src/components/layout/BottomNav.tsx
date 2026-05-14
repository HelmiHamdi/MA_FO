"use client";
// src/components/layout/BottomNav.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";

const tabs = [
  {
    href: "/discovery",
    label: "Découvrir",
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? "2.2" : "1.7"} strokeLinecap="round">
        <circle cx="11" cy="11" r="7"/><path d="m21 21-3.5-3.5"/>
      </svg>
    ),
  },
  {
    href: "/connections",
    label: "Connexions",
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? "2.2" : "1.7"} strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: "/meetings",
    label: "Agenda",
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? "2.2" : "1.7"} strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="3"/>
        <path d="M8 2v4M16 2v4M3 10h18"/>
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
      </svg>
    ),
  },
  {
    href: "/notifications",
    label: "Alertes",
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? "2.2" : "1.7"} strokeLinecap="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: ["unread-count"],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <nav className="tab-nav safe-area-bottom">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-around",
        padding: "8px 4px 10px", maxWidth: 480, margin: "0 auto",
      }}>
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const isNotif = tab.href === "/notifications";
          const unread = data?.unreadCount ?? 0;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                position: "relative",
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 4, padding: "6px 16px", textDecoration: "none",
              }}
            >
              {active && (
                <motion.div
                  layoutId="tab-pill"
                  style={{
                    position: "absolute", inset: 0,
                    background: "rgba(124,58,237,0.12)",
                    borderRadius: 12,
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <div style={{
                position: "relative", zIndex: 1,
                color: active ? "#a78bfa" : "var(--text-muted)",
                transition: "color 0.2s",
                filter: active ? "drop-shadow(0 0 5px rgba(167,139,250,0.35))" : "none",
              }}>
                {tab.icon(active)}
              </div>
              <span style={{
                position: "relative", zIndex: 1,
                fontSize: "0.6rem", fontWeight: active ? 600 : 400,
                letterSpacing: "0.04em",
                color: active ? "#a78bfa" : "var(--text-ghost)",
                transition: "color 0.2s",
              }}>
                {tab.label}
              </span>
              {isNotif && unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  style={{
                    position: "absolute", top: 4, right: 8,
                    width: "1rem", height: "1rem",
                    background: "#ec4899", borderRadius: 99,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.5rem", fontWeight: 700, color: "#fff",
                  }}
                >
                  {unread > 9 ? "9+" : unread}
                </motion.span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}