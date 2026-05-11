"use client";
// src/app/(app)/discovery/page.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SwipeMode from "@/components/discovery/SwipeMode";
import ViewAllMode from "@/components/discovery/ViewAllMode";
import { useTheme } from "@/context/ThemeContext";

type Mode = "swipe" | "all";

export default function DiscoveryPage() {
  const [mode, setMode] = useState<Mode>("swipe");
  const { toggleTheme, isDark } = useTheme();

  return (
    <div className="min-h-dvh">

      {/* ── Header ── */}
      <div className="px-5 pt-14 pb-5 lg:pt-8 lg:pb-6">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-5">
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
              Découvrir
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginTop: "2px" }}>
              Trouvez vos prochaines connexions
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle — visible only on mobile (desktop uses sidebar) */}
            <button onClick={toggleTheme} className="theme-toggle lg:hidden" aria-label="Toggle theme">
              {isDark ? "☀️" : "🌙"}
            </button>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full" style={{
              background: "linear-gradient(135deg, #7c3aed, #ec4899)",
              boxShadow: "0 0 0 2px rgba(139,92,246,0.35), 0 0 0 4px rgba(139,92,246,0.08)",
            }} />
          </div>
        </motion.div>

        {/* ── Mode toggle ── */}
        <div className="relative flex gap-1 p-1 rounded-2xl"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--border-subtle)" }}>
          {(["swipe", "all"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className="relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 z-10"
              style={{ color: mode === m ? "white" : "var(--text-muted)", border: "none", background: "none", cursor: "pointer" }}>
              {mode === m && (
                <motion.div layoutId="mode-pill" className="absolute inset-0 rounded-xl"
                  style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", boxShadow: "0 4px 16px rgba(109,40,217,0.35)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }} />
              )}
              <span className="relative z-10">{m === "swipe" ? "🎴" : "🔍"}</span>
              <span className="relative z-10">{m === "swipe" ? "Swipe" : "Explorer"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content: single column mobile, two-col on desktop ── */}
      <AnimatePresence mode="wait">
        {mode === "swipe" ? (
          <motion.div key="swipe"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <SwipeMode />
          </motion.div>
        ) : (
          <motion.div key="all"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <ViewAllMode />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}