"use client";
// src/components/layout/SidebarNav.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/authStore";

const navItems = [
  { href: "/discovery",     label: "Découvrir",   emoji: "🔍" },
  { href: "/connections",   label: "Connexions",  emoji: "🤝" },
  { href: "/meetings",      label: "Agenda",      emoji: "📅" },
  { href: "/notifications", label: "Notifications", emoji: "🔔" },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const { toggleTheme, isDark } = useTheme();
  const { participant } = useAuthStore();
  const { data } = useQuery({
    queryKey: ["unread-count"],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data),
    refetchInterval: 30_000,
  });
  const unread = data?.unreadCount ?? 0;

  return (
    <aside className="sidebar-nav">
      {/* Logo */}
      <div className="flex items-center gap-3 px-1 mb-8">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #ec4899 100%)",
            boxShadow: "0 4px 16px rgba(109,40,217,0.4)",
          }}>
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M8 16C8 11.58 11.58 8 16 8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M16 8C20.42 8 24 11.58 24 16" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M24 16C24 20.42 20.42 24 16 24" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="16" cy="16" r="3.5" fill="white"/>
          </svg>
        </div>
        <span style={{
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem",
          letterSpacing: "-0.02em", color: "var(--text-primary)",
        }}>
          Matchmaking
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const isNotif = item.href === "/notifications";
          return (
            <Link key={item.href} href={item.href}
              className={`sidebar-link ${active ? "active" : ""}`}>
              {active && (
                <motion.div layoutId="sidebar-pill" className="absolute inset-0 rounded-[var(--r-lg)]"
                  style={{ background: "rgba(124,58,237,0.10)" }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }} />
              )}
              <span className="relative z-10 text-lg w-6 text-center">{item.emoji}</span>
              <span className="relative z-10 flex-1">{item.label}</span>
              {isNotif && unread > 0 && (
                <span className="relative z-10 flex items-center justify-center rounded-full text-white"
                  style={{
                    width: "1.3rem", height: "1.3rem",
                    background: "linear-gradient(135deg, #ec4899, #db2777)",
                    fontSize: "0.6rem", fontWeight: 700,
                    boxShadow: "0 2px 8px rgba(236,72,153,0.4)",
                  }}>
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: profile + theme toggle */}
      <div className="mt-auto pt-4 border-t" style={{ borderColor: "var(--border-ghost)" }}>
        {/* Theme toggle */}
        <button onClick={toggleTheme} className="w-full sidebar-link mb-2">
          <span className="text-lg w-6 text-center">{isDark ? "☀️" : "🌙"}</span>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            {isDark ? "Mode jour" : "Mode nuit"}
          </span>
        </button>

        {/* Profile */}
        <Link href="/profile" className="sidebar-link">
          <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
            {participant?.photoUrl && (
              <img src={participant.photoUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }} className="truncate">
              {participant?.firstName} {participant?.lastName}
            </p>
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }} className="truncate">
              {participant?.company}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );
}