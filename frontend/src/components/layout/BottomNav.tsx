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
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={active ? "2.5" : "1.8"}
          fill={active ? "currentColor" : "none"} fillOpacity="0.15"/>
        <path d="m21 21-3.5-3.5" stroke="currentColor" strokeWidth={active ? "2.5" : "1.8"} strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/connections",
    label: "Connexions",
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth={active ? "2.5" : "1.8"} strokeLinecap="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth={active ? "2.5" : "1.8"}
          fill={active ? "currentColor" : "none"} fillOpacity="0.18"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth={active ? "2.5" : "1.8"} strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/meetings",
    label: "Agenda",
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth={active ? "2.5" : "1.8"}
          fill={active ? "currentColor" : "none"} fillOpacity="0.15"/>
        <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" strokeWidth={active ? "2.5" : "1.8"} strokeLinecap="round"/>
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/notifications",
    label: "Alertes",
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth={active ? "2.5" : "1.8"}
          strokeLinecap="round" fill={active ? "currentColor" : "none"} fillOpacity="0.15"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth={active ? "2.5" : "1.8"} strokeLinecap="round"/>
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
      <div className="flex items-center justify-around py-3 px-1 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const isNotif = tab.href === "/notifications";
          const unread = data?.unreadCount ?? 0;

          return (
            <Link key={tab.href} href={tab.href}
              className="relative flex flex-col items-center gap-1.5 px-5 py-1 group">
              {active && (
                <motion.div layoutId="nav-pill" className="absolute inset-0 rounded-2xl"
                  style={{ background: "rgba(124,58,237,0.12)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }} />
              )}
              <div className="relative z-10 transition-all duration-200"
                style={{
                  color: active ? "var(--brand-400)" : "var(--text-muted)",
                  filter: active ? "drop-shadow(0 0 6px rgba(167,139,250,0.4))" : "none",
                  transform: active ? "scale(1.05)" : "scale(1)",
                }}>
                {tab.icon(active)}
              </div>
              <span className="relative z-10 transition-all duration-200"
                style={{
                  fontSize: "0.625rem",
                  fontWeight: active ? 600 : 400,
                  letterSpacing: "0.04em",
                  color: active ? "var(--brand-400)" : "var(--text-ghost)",
                }}>
                {tab.label}
              </span>

              {isNotif && unread > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute top-0.5 right-2 flex items-center justify-center rounded-full"
                  style={{
                    width: "1.1rem", height: "1.1rem",
                    background: "linear-gradient(135deg, #ec4899, #db2777)",
                    fontSize: "0.55rem", fontWeight: 700, color: "#fff",
                    boxShadow: "0 2px 8px rgba(236,72,153,0.5)",
                  }}>
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