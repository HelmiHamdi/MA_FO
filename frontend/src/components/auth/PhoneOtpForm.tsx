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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="auth-card-title" style={{ marginBottom: "0.3rem" }}>
          Connexion par SMS
        </h2>
        <p className="auth-card-sub" style={{ marginBottom: 0 }}>
          Entrez votre numéro de téléphone enregistré
        </p>
      </div>

      {/* Phone field */}
      <div>
        <label className="form-label">Numéro de téléphone</label>
        <div className="flex gap-2">
          {/* Country selector */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="input-glass"
              style={{
                paddingRight: "2rem",
                paddingLeft: "0.75rem",
                appearance: "none",
                cursor: "pointer",
                width: "auto",
              }}
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}
                  style={{ background: "var(--auth-card-bg)" }}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <span style={{
              position: "absolute", right: "0.6rem", top: "50%",
              transform: "translateY(-50%)", pointerEvents: "none",
              color: "var(--auth-label-color)", fontSize: "0.7rem",
            }}>▾</span>
          </div>

          {/* Number input */}
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
        <p style={{ fontSize: "0.72rem", color: "var(--auth-label-color)", marginTop: "6px" }}>
          {selectedCountry.flag} {selectedCountry.name} · {countryCode}
        </p>
      </div>

      <motion.button
        type="submit"
        disabled={loading || !number.trim()}
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
          "Recevoir le code SMS →"
        )}
      </motion.button>
    </form>
  );
}