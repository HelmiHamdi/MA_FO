"use client";
// src/components/auth/OtpVerifyForm.tsx
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    setCountdown(60);
    setCanResend(false);
    setDigits(Array(6).fill(""));
    setError(null);
    refs.current[0]?.focus();
  }, [destination.value]);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
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
    if (e.key === "Backspace" && !digits[idx] && idx > 0)
      refs.current[idx - 1]?.focus();
    if (e.key === "ArrowLeft" && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
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
      const payload =
        destination.type === "email"
          ? { email: destination.value, code: otp }
          : { phone: destination.value, code: otp };

      // silentPost retourne directement data (pas { data })
      const data = await authApi.verifyOtp(payload);

      setAuth(
        data.participant,
        { accessToken: data.accessToken, refreshToken: data.refreshToken },
        {
          isFirstLogin: data.isFirstLogin,
          needsProfileCompletion: data.needsProfileCompletion,
        },
      );
      toast.success("Connexion réussie !");
      if (data.needsProfileCompletion) router.replace("/profile/complete");
      else router.replace("/discovery");
    } catch (err: unknown) {
      const msg =
        (err as any)?.response?.data?.message ??
        (err as any)?.message ??
        "Code incorrect";
      const status = (err as any)?.response?.status ?? null;

      setError(msg);

      // Vider les inputs seulement si bloqué ou expiré
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
      if (destination.type === "email")
        await authApi.requestEmailOtp(destination.value);
      else await authApi.requestPhoneOtp(destination.value);
      setCanResend(false);
      setCountdown(60);
      setDigits(Array(6).fill(""));
      setError(null);
      refs.current[0]?.focus();
      toast.success("Nouveau code envoyé !");
    } catch {
      setError("Impossible de renvoyer le code");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Vérification</h2>
        <p className="text-white/45 text-sm">
          Code envoyé à{" "}
          <span className="text-brand-300 font-medium">{destination.value}</span>
        </p>
      </div>

      <div className="flex gap-2 justify-between" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <motion.input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="otp-input"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            style={{
              borderColor: error
                ? "rgba(239,68,68,0.6)"
                : d
                  ? "rgba(109,40,217,0.6)"
                  : "rgba(255,255,255,0.12)",
              background: error
                ? "rgba(239,68,68,0.08)"
                : d
                  ? "rgba(109,40,217,0.15)"
                  : "rgba(255,255,255,0.05)",
            }}
            disabled={loading}
          />
        ))}
      </div>

      {/* Erreur inline — pas de toast, pas de console */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20"
        >
          <span className="text-red-400 text-lg leading-none">⚠</span>
          <p className="text-red-300 text-sm">{error}</p>
        </motion.div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 text-brand-300 text-sm">
          <span className="w-4 h-4 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
          Vérification…
        </div>
      )}

      <div className="text-center">
        {canResend ? (
          <button
            onClick={resend}
            className="text-brand-400 text-sm hover:text-brand-300 transition-colors font-medium"
          >
            Renvoyer le code
          </button>
        ) : (
          <p className="text-white/30 text-sm">
            Renvoi disponible dans{" "}
            <span className="text-white/50 font-mono">{countdown}s</span>
          </p>
        )}
      </div>
    </div>
  );
}