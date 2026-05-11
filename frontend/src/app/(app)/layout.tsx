"use client";
// src/app/(app)/layout.tsx
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import BottomNav from "@/components/layout/BottomNav";
import SidebarNav from "@/components/layout/SidebarNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, needsProfileCompletion } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) { router.replace("/auth"); return; }
    const isOnComplete = pathname === "/profile/complete";
    if (needsProfileCompletion && !isOnComplete) router.replace("/profile/complete");
  }, [isAuthenticated, needsProfileCompletion, pathname, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="page-container">
      {/* Desktop sidebar — hidden on mobile via CSS */}
      <SidebarNav />

      {/* Page content */}
      <main style={{ position: "relative", zIndex: 1 }}>
        {children}
      </main>

      {/* Mobile bottom nav — hidden on desktop via CSS */}
      <BottomNav />
    </div>
  );
}