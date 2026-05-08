"use client";
// src/components/auth/EmailOtpForm.tsx
import { useState } from "react";
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
      const msg =
        (err as any)?.response?.data?.message ?? "Erreur lors de l'envoi";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">
          Connexion par email
        </h2>
        <p className="text-white/45 text-sm">
          Entrez votre adresse email enregistrée
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-white/60">Adresse email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@entreprise.com"
          className="input-glass"
          autoFocus
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Envoi en cours…
          </span>
        ) : (
          "Recevoir le code"
        )}
      </button>
    </form>
  );
}