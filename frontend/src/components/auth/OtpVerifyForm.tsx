"use client";
// src/components/auth/OtpVerifyForm.tsx
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

interface Props {
  destination: { value: string; type: "email" | "phone" };
}

export default function OtpVerifyForm({ destination }: Props) {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);

  useEffect(() => {
    setCountdown(60); setCanResend(false);
    setDigits(Array(6).fill("")); setError(null);
    refs.current[0]?.focus();
  }, [destination.value]);

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleDigit = (idx: number, value: string) => {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    setError(null);
    if (clean && idx < 5) refs.current[idx + 1]?.focus();
    if (next.every((d) => d !== "") && clean) submit(next.join(""));
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === "ArrowLeft" && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    pasted.split("").forEach((d, i) => (next[i] = d));
    setDigits(next);
    setError(null);
    if (pasted.length === 6) submit(pasted);
    else refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const submit = async (otp: string) => {
    setLoading(true);
    setError(null);
    try {
      const payload = destination.type === "email"
        ? { email: destination.value, code: otp }
        : { phone: destination.value, code: otp };
      const data = await authApi.verifyOtp(payload);
      setSuccess(true);
      setAuth(
        data.participant,
        { accessToken: data.accessToken, refreshToken: data.refreshToken },
        { isFirstLogin: data.isFirstLogin, needsProfileCompletion: data.needsProfileCompletion },
      );
      toast.success("Connexion réussie !");
      setTimeout(() => {
        if (data.needsProfileCompletion) router.replace("/profile/complete");
        else router.replace("/home");
      }, 600);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? (err as any)?.message ?? "Code incorrect";
      const status = (err as any)?.response?.status ?? null;
      setError(msg);
      if (status === 403 || msg.includes("expiré") || msg.includes("bloqué")) {
        setDigits(Array(6).fill(""));
        refs.current[0]?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!canResend) return;
    try {
      if (destination.type === "email") await authApi.requestEmailOtp(destination.value);
      else await authApi.requestPhoneOtp(destination.value);
      setCanResend(false); setCountdown(60);
      setDigits(Array(6).fill("")); setError(null);
      refs.current[0]?.focus();
      toast.success("Nouveau code envoyé !");
    } catch { setError("Impossible de renvoyer le code"); }
  };

  // Mask the destination for display
  const maskedDest = destination.type === "email"
    ? destination.value.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(Math.max(b.length, 3)) + c)
    : destination.value.slice(0, -4).replace(/./g, "*") + destination.value.slice(-4);

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.02em" }}
            className="text-white mb-1">
          Vérification
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>
          Code envoyé à{" "}
          <span style={{ color: "#a78bfa", fontWeight: 500 }}>{maskedDest}</span>
        </p>
      </div>

      {/* OTP Grid */}
      <div className="flex gap-2 justify-between" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <motion.input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="otp-input"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 22 }}
            disabled={loading || success}
            style={{
              borderColor: success
                ? "rgba(52,211,153,0.7)"
                : error
                  ? "rgba(248,113,113,0.6)"
                  : d
                    ? "rgba(139,92,246,0.65)"
                    : "rgba(255,255,255,0.09)",
              background: success
                ? "rgba(52,211,153,0.1)"
                : error
                  ? "rgba(248,113,113,0.08)"
                  : d
                    ? "rgba(139,92,246,0.14)"
                    : "rgba(255,255,255,0.04)",
              boxShadow: d && !error && !success ? "0 0 12px rgba(139,92,246,0.2)" : "none",
            }}
          />
        ))}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}
          >
            <span style={{ fontSize: "1rem" }}>⚠️</span>
            <p style={{ color: "#fca5a5", fontSize: "0.875rem" }}>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center gap-2.5" style={{ color: "#a78bfa", fontSize: "0.875rem" }}>
          <span className="animate-spin" style={{
            width: "1rem", height: "1rem",
            border: "2px solid rgba(167,139,250,0.3)", borderTopColor: "#a78bfa",
            borderRadius: "50%", display: "inline-block",
          }} />
          Vérification…
        </div>
      )}

      {/* Resend */}
      <div className="text-center">
        {canResend ? (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={resend}
            style={{ color: "#a78bfa", fontSize: "0.875rem", fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}
          >
            Renvoyer le code
          </motion.button>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Renvoi dans{" "}
            <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {countdown}s
            </span>
          </p>
        )}
      </div>
    </div>
  );
}