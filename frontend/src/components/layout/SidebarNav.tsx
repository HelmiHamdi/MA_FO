"use client";
// src/components/layout/SidebarNav.tsx
// Design: GitHub-dark sidebar inspired by Mantine Admin screenshot
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/authStore";
import { getInitials, getFullName } from "@/lib/utils";

const navGroups = [
  {
    label: "Principal",
    items: [
      {
        href: "/discovery",
        label: "Découvrir",
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7"/><path d="m21 21-3.5-3.5"/>
          </svg>
        ),
      },
      {
        href: "/connections",
        label: "Connexions",
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
      {
        href: "/meetings",
        label: "Agenda",
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="3"/>
            <path d="M8 2v4M16 2v4M3 10h18"/>
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
          </svg>
        ),
      },
      {
        href: "/notifications",
        label: "Notifications",
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        ),
        badge: true,
      },
    ],
  },
  {
    label: "Compte",
    items: [
      {
        href: "/profile",
        label: "Mon Profil",
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        ),
      },
      {
        href: "/chat",
        label: "Messages",
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        ),
      },
    ],
  },
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
      {/* ── Logo / Brand ── */}
      <div className="sidebar-header">
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(124,58,237,0.4)",
        }}>
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
            <path d="M8 16C8 11.58 11.58 8 16 8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M16 8C20.42 8 24 11.58 24 16" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M24 16C24 20.42 20.42 24 16 24" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="16" cy="16" r="3.5" fill="white"/>
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "rgba(255,255,255,0.92)", letterSpacing: "-0.01em" }}>
            Matchmaking
          </p>
          <p style={{ margin: 0, fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>
            B2B Platform
          </p>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="sidebar-search">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7"/><path d="m21 21-3.5-3.5"/>
        </svg>
        <span style={{ fontSize: "0.8rem" }}>Rechercher…</span>
        <span style={{ marginLeft: "auto", fontSize: "0.65rem", opacity: 0.5, background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: 4 }}>⌘K</span>
      </div>

      {/* ── Nav groups ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0 8px" }}>
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="sidebar-nav-section">{group.label}</p>
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={`sidebar-link ${active ? "active" : ""}`}>
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      style={{
                        position: "absolute", inset: 0,
                        borderRadius: "var(--r-md)",
                        background: "rgba(124,58,237,0.18)",
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span style={{
                    position: "relative", zIndex: 1,
                    color: active ? "#c4b5fd" : "rgba(255,255,255,0.5)",
                    display: "flex", alignItems: "center",
                  }}>
                    {item.icon}
                  </span>
                  <span style={{ position: "relative", zIndex: 1, flex: 1 }}>
                    {item.label}
                  </span>
                  {item.badge && unread > 0 && (
                    <span style={{
                      position: "relative", zIndex: 1,
                      minWidth: "1.25rem", height: "1.25rem",
                      background: "#ec4899", borderRadius: 99,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.6rem", fontWeight: 700, color: "white",
                      padding: "0 4px",
                    }}>
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Bottom: theme + profile ── */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "8px 12px",
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="sidebar-link"
          style={{ width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer" }}
        >
          <span style={{ color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center" }}>
            {isDark ? (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </span>
          <span style={{ fontSize: "0.85rem" }}>{isDark ? "Mode jour" : "Mode nuit"}</span>
        </button>

        {/* Profile */}
        <Link href="/profile" className="sidebar-link" style={{ marginTop: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #7c3aed, #ec4899)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.7rem", fontWeight: 700, color: "white",
            overflow: "hidden", position: "relative",
          }}>
            {participant?.photoUrl ? (
              <img src={participant.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
            ) : (
              getInitials(participant?.firstName, participant?.lastName)
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {participant?.firstName} {participant?.lastName}
            </p>
            <p style={{ margin: 0, fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {participant?.company || participant?.email}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );
}