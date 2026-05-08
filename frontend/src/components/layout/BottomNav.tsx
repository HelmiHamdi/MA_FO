"use client";
// src/components/layout/BottomNav.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";

const tabs = [
  { href: "/discovery", label: "Découvrir", icon: (active: boolean) => (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path d={active ? "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" : "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"}
        stroke="currentColor" strokeWidth="1.8" fill={active ? "currentColor" : "none"} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="9" r="2.5" fill={active ? "rgba(0,0,0,0.3)" : "none"} stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )},
  { href: "/connections", label: "Connexions", icon: (active: boolean) => (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" fill={active ? "currentColor" : "none"} fillOpacity="0.2"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )},
  { href: "/meetings", label: "Agenda", icon: (active: boolean) => (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" fill={active ? "currentColor" : "none"} fillOpacity="0.15"/>
      <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )},
  { href: "/notifications", label: "Alertes", icon: (active: boolean) => (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill={active ? "currentColor" : "none"} fillOpacity="0.15"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )},
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
      <div className="flex items-center justify-around py-2 px-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const isNotif = tab.href === "/notifications";
          const unread = data?.unreadCount ?? 0;

          return (
            <Link key={tab.href} href={tab.href} className="relative flex flex-col items-center gap-1 px-4 py-1">
              <div className={`transition-all duration-200 ${active ? "text-brand-400" : "text-white/40 hover:text-white/60"}`}>
                {tab.icon(active)}
              </div>
              {active && (
                <motion.div
                  layoutId="tab-dot"
                  className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-brand-400"
                />
              )}
              {isNotif && unread > 0 && (
                <span className="absolute top-0 right-2 w-4 h-4 bg-accent-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
              <span className={`text-[10px] font-medium transition-colors ${active ? "text-brand-400" : "text-white/30"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}