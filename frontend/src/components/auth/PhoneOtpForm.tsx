"use client";
// src/components/auth/PhoneOtpForm.tsx
import { useState } from "react";
import { authApi } from "@/lib/api";
import toast from "react-hot-toast";

const COUNTRY_CODES = [
  { code: "+216", flag: "🇹🇳", name: "Tunisie" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+212", flag: "🇲🇦", name: "Maroc" },
  { code: "+213", flag: "🇩🇿", name: "Algérie" },
  { code: "+1", flag: "🇺🇸", name: "USA" },
];

interface Props {
  onSuccess: (destination: string, type: "phone") => void;
}

export default function PhoneOtpForm({ onSuccess }: Props) {
  const [countryCode, setCountryCode] = useState("+216");
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const fullPhone = `${countryCode}${number.replace(/\D/g, "")}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number.trim()) return;

    setLoading(true);
    try {
      const data = await authApi.requestPhoneOtp(fullPhone);
      toast.success(data.message || "Code SMS envoyé !");
      onSuccess(fullPhone, "phone");
    } catch (err: unknown) {
      const msg =
        (err as any)?.response?.data?.message ?? "Numéro non trouvé";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">
          Connexion par SMS
        </h2>
        <p className="text-white/45 text-sm">
          Entrez votre numéro de téléphone enregistré
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-white/60">Numéro de téléphone</label>
        <div className="flex gap-2">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="glass rounded-xl px-3 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-brand-400/50 bg-transparent cursor-pointer"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code} className="bg-gray-900">
                {c.flag} {c.code}
              </option>
            ))}
          </select>
          <input
            type="tel"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="XX XXX XXX"
            className="input-glass flex-1"
            autoFocus
            required
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !number.trim()}
        className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Envoi en cours…
          </span>
        ) : (
          "Recevoir le code SMS"
        )}
      </button>
    </form>
  );
}