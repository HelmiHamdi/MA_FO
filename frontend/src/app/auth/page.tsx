"use client";
// src/app/auth/page.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EmailOtpForm from "@/components/auth/EmailOtpForm";
import PhoneOtpForm from "@/components/auth/PhoneOtpForm";
import QrLoginForm from "@/components/auth/QrLoginForm";
import OtpVerifyForm from "@/components/auth/OtpVerifyForm";

type Method = "email" | "phone" | "qr" | null;
type Step = "select" | "input" | "verify";

export default function AuthPage() {
  const [method, setMethod] = useState<Method>(null);
  const [step, setStep] = useState<Step>("select");
  // FIX: on stocke la valeur BRUTE (email/phone tel que saisi) pour le renvoi,
  // pas la valeur masquée retournée par le serveur.
  const [otpDestination, setOtpDestination] = useState<{
    value: string;
    type: "email" | "phone";
  } | null>(null);

  const handleOtpSent = (rawValue: string, type: "email" | "phone") => {
    setOtpDestination({ value: rawValue, type });
    setStep("verify");
  };

  const handleBack = () => {
    if (step === "verify") {
      setStep("input");
      return;
    }
    if (step === "input") {
      setMethod(null);
      setStep("select");
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 relative">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl animate-float" />
        <div
          className="absolute -bottom-32 -right-32 w-80 h-80 bg-accent-500/15 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-900/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="font-display text-2xl text-white">Matchmaking</span>
          </div>
          <p className="text-white/40 text-sm tracking-widest uppercase font-light">
            Où les opportunités se rencontrent
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass rounded-3xl p-8"
        >
          <AnimatePresence mode="wait">
            {/* Step: select method */}
            {step === "select" && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <h1 className="text-2xl font-semibold text-white mb-2">
                  Connexion
                </h1>
                <p className="text-white/50 text-sm mb-8">
                  Choisissez votre méthode d&apos;accès
                </p>

                <div className="space-y-3">
                  <LoginMethodCard
                    icon="✉️"
                    title="Email"
                    description="Recevez un code à 6 chiffres"
                    onClick={() => {
                      setMethod("email");
                      setStep("input");
                    }}
                  />
                  <LoginMethodCard
                    icon="📱"
                    title="SMS"
                    description="Code par SMS sur votre téléphone"
                    onClick={() => {
                      setMethod("phone");
                      setStep("input");
                    }}
                  />
                  <LoginMethodCard
                    icon="⚡"
                    title="QR Code Badge"
                    description="Scannez votre badge — accès instantané"
                    highlight
                    onClick={() => {
                      setMethod("qr");
                      setStep("input");
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* Step: input */}
            {step === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  onClick={handleBack}
                  className="btn-ghost mb-6 flex items-center gap-2 -ml-2 text-white/50 hover:text-white"
                >
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M19 12H5M5 12l7 7M5 12l7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Retour
                </button>
                {method === "email" && (
                  <EmailOtpForm onSuccess={handleOtpSent} />
                )}
                {method === "phone" && (
                  <PhoneOtpForm onSuccess={handleOtpSent} />
                )}
                {method === "qr" && <QrLoginForm />}
              </motion.div>
            )}

            {/* Step: OTP verify */}
            {step === "verify" && otpDestination && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  onClick={handleBack}
                  className="btn-ghost mb-6 flex items-center gap-2 -ml-2 text-white/50 hover:text-white"
                >
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M19 12H5M5 12l7 7M5 12l7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Changer
                </button>
                <OtpVerifyForm destination={otpDestination} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="text-center text-white/20 text-xs mt-6">
          © 2026 · Matchmaking App · Tunis, Tunisie
        </p>
      </div>
    </div>
  );
}

function LoginMethodCard({
  icon,
  title,
  description,
  onClick,
  highlight = false,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01, x: 4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 text-left group ${
        highlight
          ? "bg-gradient-to-r from-brand-600/30 to-accent-500/20 border-brand-400/40 hover:border-brand-400/70"
          : "glass border-white/8 hover:border-white/20 hover:bg-white/5"
      }`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
          highlight ? "bg-brand-500/30" : "bg-white/5"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white">{title}</div>
        <div className="text-xs text-white/40 mt-0.5">{description}</div>
      </div>
      <svg
        width="16"
        height="16"
        fill="none"
        viewBox="0 0 24 24"
        className="text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0"
      >
        <path
          d="M9 18l6-6-6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.button>
  );
}