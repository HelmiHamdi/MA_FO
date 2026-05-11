"use client";
// src/components/auth/EmailOtpForm.tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { authApi } from "@/lib/api";
import toast from "react-hot-toast";

interface Props {
  onSuccess: (destination: string, type: "email") => void;
}

export default function EmailOtpForm({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const data = await authApi.requestEmailOtp(email.trim().toLowerCase());
      toast.success(data.message || "Code envoyé !");
      onSuccess(email.trim().toLowerCase(), "email");
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? "Erreur lors de l'envoi";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.02em" }}
            className="text-white mb-1">
          Connexion par email
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Entrez votre adresse email enregistrée
        </p>
      </div>

      <div className="space-y-2">
        <label style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Adresse email
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base" style={{ pointerEvents: "none" }}>
            ✉️
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@entreprise.com"
            className="input-glass"
            style={{ paddingLeft: "2.5rem" }}
            autoFocus
            required
          />
        </div>
      </div>

      <motion.button
        type="submit"
        disabled={loading || !email.trim()}
        whileTap={{ scale: 0.98 }}
        className="btn-primary w-full"
        style={{ height: "3rem" }}
      >
        {loading ? (
          <>
            <span className="animate-spin" style={{
              width: "1rem", height: "1rem",
              border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white",
              borderRadius: "50%", display: "inline-block",
            }} />
            Envoi en cours…
          </>
        ) : (
          "Recevoir le code →"
        )}
      </motion.button>
    </form>
  );
}