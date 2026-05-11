"use client";
// src/app/auth/page.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EmailOtpForm from "@/components/auth/EmailOtpForm";
import PhoneOtpForm from "@/components/auth/PhoneOtpForm";
import QrLoginForm from "@/components/auth/QrLoginForm";
import OtpVerifyForm from "@/components/auth/OtpVerifyForm";
import { useTheme } from "@/context/ThemeContext";

type Method = "email" | "phone" | "qr" | null;
type Step = "select" | "input" | "verify";

export default function AuthPage() {
  const [method, setMethod] = useState<Method>(null);
  const [step, setStep] = useState<Step>("select");
  const [otpDestination, setOtpDestination] = useState<{
    value: string; type: "email" | "phone";
  } | null>(null);
  const { toggleTheme, isDark } = useTheme();

  const handleOtpSent = (rawValue: string, type: "email" | "phone") => {
    setOtpDestination({ value: rawValue, type });
    setStep("verify");
  };

  const handleBack = () => {
    if (step === "verify") { setStep("input"); return; }
    if (step === "input") { setMethod(null); setStep("select"); }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">

      {/* ── Animated aurora blobs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.85, 0.6] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, var(--aurora-1) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-40 -right-40 w-[450px] h-[450px] rounded-full"
          style={{ background: "radial-gradient(circle, var(--aurora-3) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full"
          style={{ background: "radial-gradient(circle, var(--aurora-2) 0%, transparent 70%)" }}
        />
      </div>

      {/* Theme toggle — top right */}
      <motion.button
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        onClick={toggleTheme}
        className="theme-toggle absolute top-5 right-5"
        aria-label="Toggle theme"
        title={isDark ? "Passer en mode jour" : "Passer en mode nuit"}
      >
        {isDark ? "☀️" : "🌙"}
      </motion.button>

      <div className="relative z-10 w-full max-w-md">

        {/* ── Logo ── */}
        <motion.div
          initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10"
        >
          <div className="inline-flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #ec4899 100%)",
                  boxShadow: "0 8px 32px rgba(109,40,217,0.45), inset 0 1px 0 rgba(255,255,255,0.2)",
                }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M8 16C8 11.58 11.58 8 16 8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M16 8C20.42 8 24 11.58 24 16" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M24 16C24 20.42 20.42 24 16 24" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="16" cy="16" r="3.5" fill="white"/>
                  <circle cx="8" cy="16" r="2.5" fill="white" opacity="0.7"/>
                  <circle cx="24" cy="16" r="2.5" fill="white" opacity="0.7"/>
                </svg>
              </div>
              <div className="absolute inset-0 rounded-2xl"
                style={{ boxShadow: "0 0 40px rgba(109,40,217,0.4)", filter: "blur(10px)", opacity: 0.5 }} />
            </div>
            <div>
              <h1 className="text-gradient"
                style={{ fontFamily: "var(--font-display)", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                Matchmaking
              </h1>
              <p className="mt-1"
                style={{ fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                Où les opportunités se rencontrent
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="glass-lg rounded-3xl p-8"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <AnimatePresence mode="wait">
            {step === "select" && (
              <motion.div key="select"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.25 }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}
                    className="mb-1">
                  Connexion
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }} className="mb-7">
                  Choisissez votre méthode d'accès
                </p>
                <div className="space-y-2.5">
                  <LoginMethodCard icon="✉️" title="Email" description="Recevez un code à 6 chiffres"
                    onClick={() => { setMethod("email"); setStep("input"); }} />
                  <LoginMethodCard icon="📱" title="SMS" description="Code par SMS sur votre téléphone"
                    onClick={() => { setMethod("phone"); setStep("input"); }} />
                  <LoginMethodCard icon="⚡" title="QR Code Badge" description="Scannez votre badge — accès instantané"
                    highlight onClick={() => { setMethod("qr"); setStep("input"); }} />
                </div>
              </motion.div>
            )}

            {step === "input" && (
              <motion.div key="input"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <BackButton onClick={handleBack} />
                {method === "email" && <EmailOtpForm onSuccess={handleOtpSent} />}
                {method === "phone" && <PhoneOtpForm onSuccess={handleOtpSent} />}
                {method === "qr"    && <QrLoginForm />}
              </motion.div>
            )}

            {step === "verify" && otpDestination && (
              <motion.div key="verify"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <BackButton onClick={handleBack} label="Changer" />
                <OtpVerifyForm destination={otpDestination} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-center mt-6"
          style={{ color: "var(--text-ghost)", fontSize: "0.75rem" }}>
          © 2026 · Matchmaking App · Tunis, Tunisie
        </motion.p>
      </div>
    </div>
  );
}

function BackButton({ onClick, label = "Retour" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="btn-ghost mb-6 -ml-2 flex items-center gap-2">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
        <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {label}
    </button>
  );
}

function LoginMethodCard({ icon, title, description, onClick, highlight = false }: {
  icon: string; title: string; description: string; onClick: () => void; highlight?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ x: 3, scale: 1.005 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left group transition-all duration-200"
      style={{
        background: highlight
          ? "linear-gradient(135deg, rgba(109,40,217,0.12) 0%, rgba(236,72,153,0.06) 100%)"
          : "var(--glass-bg)",
        border: highlight ? "1px solid rgba(139,92,246,0.30)" : "1px solid var(--border-subtle)",
        boxShadow: highlight ? "var(--shadow-brand)" : "none",
      }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: highlight ? "rgba(109,40,217,0.18)" : "var(--glass-bg-md)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{description}</p>
      </div>
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
        style={{ color: highlight ? "var(--brand-400)" : "var(--text-muted)" }}
        className="flex-shrink-0 group-hover:translate-x-1 transition-transform">
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </motion.button>
  );
}