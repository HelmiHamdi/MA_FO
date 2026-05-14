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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="auth-card-title" style={{ marginBottom: "0.3rem" }}>
          Connexion par email
        </h2>
        <p className="auth-card-sub" style={{ marginBottom: 0 }}>
          Entrez votre adresse email enregistrée
        </p>
      </div>

      {/* Email field */}
      <div>
        <label className="form-label">Adresse email</label>
        <div className="relative">
          <span style={{
            position: "absolute", left: "0.875rem", top: "50%",
            transform: "translateY(-50%)", pointerEvents: "none",
            color: "var(--auth-icon-color)", display: "flex",
          }}>
            <MailIcon />
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@entreprise.com"
            className="input-glass"
            style={{ paddingLeft: "2.75rem" }}
            autoFocus
            required
          />
        </div>
      </div>

      <motion.button
        type="submit"
        disabled={loading || !email.trim()}
        whileTap={{ scale: 0.98 }}
        className="btn-primary"
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

const MailIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 7 10-7" />
  </svg>
);