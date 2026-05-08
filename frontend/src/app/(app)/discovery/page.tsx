"use client";
// src/app/(app)/discovery/page.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SwipeMode from "@/components/discovery/SwipeMode";
import ViewAllMode from "@/components/discovery/ViewAllMode";

type Mode = "swipe" | "all";

export default function DiscoveryPage() {
  const [mode, setMode] = useState<Mode>("swipe");

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-semibold text-white mb-5">Découvrir</h1>

        {/* Mode toggle */}
        <div className="glass rounded-2xl p-1 flex gap-1">
          {(["swipe", "all"] as Mode[]).map((m) => (
            <motion.button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                mode === m ? "bg-brand-600 text-white shadow-glow-sm" : "text-white/50 hover:text-white/70"
              }`}
              layout
            >
              {m === "swipe" ? "🎴 Swipe" : "🔍 Explorer"}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {mode === "swipe" ? (
          <motion.div key="swipe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SwipeMode />
          </motion.div>
        ) : (
          <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ViewAllMode />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}