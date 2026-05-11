"use client";
// src/components/auth/PhoneOtpForm.tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { authApi } from "@/lib/api";
import toast from "react-hot-toast";

const COUNTRY_CODES = [
  { code: "+216", flag: "🇹🇳", name: "Tunisie" },
  { code: "+33",  flag: "🇫🇷", name: "France"  },
  { code: "+212", flag: "🇲🇦", name: "Maroc"   },
  { code: "+213", flag: "🇩🇿", name: "Algérie" },
  { code: "+1",   flag: "🇺🇸", name: "USA"     },
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
      const msg = (err as any)?.response?.data?.message ?? "Numéro non trouvé";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode)!;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.02em" }}
            className="text-white mb-1">
          Connexion par SMS
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Entrez votre numéro de téléphone enregistré
        </p>
      </div>

      <div className="space-y-2">
        <label style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Numéro de téléphone
        </label>
        <div className="flex gap-2">
          {/* Country selector */}
          <div className="relative flex-shrink-0">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="appearance-none cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "var(--r-lg)",
                padding: "0.75rem 2.25rem 0.75rem 0.875rem",
                color: "white",
                fontSize: "0.9375rem",
                outline: "none",
                fontFamily: "var(--font-sans)",
              }}
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code} style={{ background: "#0e0c1a" }}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>▾</span>
          </div>

          {/* Phone number */}
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
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {selectedCountry.flag} {selectedCountry.name} · {countryCode}
        </p>
      </div>

      <motion.button
        type="submit"
        disabled={loading || !number.trim()}
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
          "Recevoir le code SMS →"
        )}
      </motion.button>
    </form>
  );
}