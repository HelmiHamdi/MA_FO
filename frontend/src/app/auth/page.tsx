"use client";
// src/app/auth/page.tsx
import "./auth.css";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import EmailOtpForm from "@/components/auth/EmailOtpForm";
import PhoneOtpForm from "@/components/auth/PhoneOtpForm";
import QrLoginForm from "@/components/auth/QrLoginForm";
import OtpVerifyForm from "@/components/auth/OtpVerifyForm";

type Method = "email" | "phone" | "qr" | null;
type Step = "select" | "input" | "verify";

export default function AuthPage() {
  const [method, setMethod] = useState<Method>(null);
  const [step, setStep] = useState<Step>("select");
  const [otpDestination, setOtpDestination] = useState<{
    value: string;
    type: "email" | "phone";
  } | null>(null);

  const handleOtpSent = (rawValue: string, type: "email" | "phone") => {
    setOtpDestination({ value: rawValue, type });
    setStep("verify");
  };

  const handleBack = () => {
    if (step === "verify") { setStep("input"); return; }
    if (step === "input") { setMethod(null); setStep("select"); }
  };

  return (
    <div className="auth-root">

      {/* ── LEFT PANEL ── */}
      <div className="auth-left">
        {/* Grid overlay */}
        <div className="auth-left-grid" />

        <div className="auth-left-inner">
          {/* Brand */}
          <div className="auth-brand">
            <div className="auth-brand-icon">
              <BrandIcon />
            </div>
            <span className="auth-brand-name">Matchmaking</span>
          </div>

          {/* Hero content */}
          <div className="auth-hero">
            <p className="auth-eyebrow">Plateforme B2B · Tunis 2026</p>
            <h1 className="auth-hero-title">
              Où les bonnes<br />
              <span className="auth-hero-accent">connexions</span><br />
              se créent.
            </h1>
            <p className="auth-hero-desc">
              Notre IA analyse vos profils pour vous mettre en relation
              avec les décideurs qui comptent vraiment.
            </p>
            <div className="auth-stats">
              <div className="auth-stat-row">
                <UsersIcon />
                <span><strong>2 400+</strong> participants inscrits</span>
              </div>
              <div className="auth-stat-row">
                <CalendarCheckIcon />
                <span><strong>1 800+</strong> meetings confirmés</span>
              </div>
              <div className="auth-stat-row">
                <ShieldIcon />
                <span><strong>Accès sécurisé</strong></span>
              </div>
            </div>
          </div>

          <p className="auth-left-footer">© 2026 · MA_FO v1.0</p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">

        {/* Mobile-only logo */}
        <div className="auth-mobile-logo">
          <div className="auth-brand-icon auth-brand-icon--solid">
            <BrandIcon />
          </div>
          <span className="auth-brand-name auth-brand-name--dark">Matchmaking</span>
        </div>

        {/* The card wrapping all form steps */}
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <AnimatePresence mode="wait">

            {step === "select" && (
              <motion.div key="select"
                initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.2 }}>
                <h2 className="auth-card-title">Bon retour</h2>
                <p className="auth-card-sub">Choisissez votre méthode de connexion</p>
                <div className="auth-methods">
                  <LoginMethodCard
                    icon={<MailIcon />}
                    title="Email"
                    description="Recevez un code à 6 chiffres par email"
                    onClick={() => { setMethod("email"); setStep("input"); }}
                  />
                  <LoginMethodCard
                    icon={<PhoneIcon />}
                    title="SMS"
                    description="Code envoyé sur votre téléphone"
                    onClick={() => { setMethod("phone"); setStep("input"); }}
                  />
                  <LoginMethodCard
                    icon={<QrIcon />}
                    title="QR Code Badge"
                    description="Scannez votre badge — accès instantané"
                    badge="Rapide"
                    highlight
                    onClick={() => { setMethod("qr"); setStep("input"); }}
                  />
                </div>
                <p className="auth-card-footer">Accès réservé aux participants pré-inscrits</p>
              </motion.div>
            )}

            {step === "input" && (
              <motion.div key="input"
                initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.2 }}>
                <BackButton onClick={handleBack} />
                {method === "email" && <EmailOtpForm onSuccess={handleOtpSent} />}
                {method === "phone" && <PhoneOtpForm onSuccess={handleOtpSent} />}
                {method === "qr" && <QrLoginForm />}
              </motion.div>
            )}

            {step === "verify" && otpDestination && (
              <motion.div key="verify"
                initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.2 }}>
                <BackButton onClick={handleBack} label="Changer" />
                <OtpVerifyForm destination={otpDestination} />
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BackButton({ onClick, label = "Retour" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="auth-back-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M5 12l7 7M5 12l7-7" />
      </svg>
      {label}
    </button>
  );
}

function LoginMethodCard({ icon, title, description, onClick, highlight = false, badge }: {
  icon: React.ReactNode; title: string; description: string;
  onClick: () => void; highlight?: boolean; badge?: string;
}) {
  return (
    <motion.button
      whileHover={{ x: 2 }} whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`auth-method${highlight ? " auth-method--featured" : ""}`}
    >
      <div className={`auth-method-icon${highlight ? " auth-method-icon--featured" : ""}`}>
        {icon}
      </div>
      <div className="auth-method-info">
        <p className="auth-method-title">
          {title}
          {badge && <span className="auth-method-badge">{badge}</span>}
        </p>
        <p className="auth-method-desc">{description}</p>
      </div>
      <div className="auth-method-arrow">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </motion.button>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const BrandIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" fill="white" />
    <path d="M5 12C5 8.13 8.13 5 12 5" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <path d="M19 12C19 15.87 15.87 19 12 19" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="5" cy="12" r="1.5" fill="rgba(255,255,255,0.7)" />
    <circle cx="19" cy="12" r="1.5" fill="rgba(255,255,255,0.7)" />
  </svg>
);
const MailIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 7 10-7" />
  </svg>
);
const PhoneIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" />
  </svg>
);
const QrIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3z M17 17h3v3h-3z M14 20h3" />
  </svg>
);
const UsersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const CalendarCheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" /><path d="M9 16l2 2 4-4" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);