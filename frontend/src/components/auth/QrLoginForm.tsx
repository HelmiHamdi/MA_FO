"use client";
// src/components/auth/QrLoginForm.tsx
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

export default function QrLoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const qrRef = useRef<any>(null);
  const didScanRef = useRef(false);

  const stopScan = async () => {
    try {
      if (qrRef.current) {
        await qrRef.current.clear?.().catch(() => {});
        qrRef.current = null;
      }
    } catch {}
  };

  useEffect(() => {
    if (!scanning) return;
    didScanRef.current = false;
    let cancelled = false;

    const initScanner = async () => {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        if (cancelled) return;
        if (!document.getElementById("qr-reader")) {
          setError("Erreur interne : conteneur introuvable.");
          setScanning(false);
          return;
        }
        const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 220 }, false);
        qrRef.current = scanner;
        scanner.render(
          async (text: string) => {
            if (didScanRef.current) return;
            didScanRef.current = true;
            await scanner.clear();
            setScanning(false);
            setScanned(true);
            await loginWithToken(text);
          },
          () => {}
        );
      } catch (err: any) {
        if (cancelled) return;
        setScanning(false);
        toast.error("Caméra non disponible");
        setError(`Caméra non disponible : ${err?.message ?? "erreur inconnue"}`);
      }
    };

    initScanner();
    return () => {
      cancelled = true;
      qrRef.current?.clear?.().catch(() => {});
      qrRef.current = null;
    };
  }, [scanning]);

  const loginWithToken = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.loginWithQr(token);
      setAuth(
        data.participant,
        { accessToken: data.accessToken, refreshToken: data.refreshToken },
        { isFirstLogin: data.isFirstLogin, needsProfileCompletion: data.needsProfileCompletion }
      );
      toast.success("Connexion réussie !");
      if (data.needsProfileCompletion) router.replace("/profile/complete");
      else router.replace("/discovery");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "QR invalide";
      setError(msg);
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => { qrRef.current?.clear?.().catch(() => {}); };
  }, []);

  const zoneBg = "var(--auth-input-bg)";
  const zoneBorder = "var(--auth-input-border)";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="auth-card-title" style={{ marginBottom: "0.3rem" }}>
          Scan QR Badge
        </h2>
        <p className="auth-card-sub" style={{ marginBottom: 0 }}>
          Scannez le QR code imprimé sur votre badge d&apos;accès
        </p>
      </div>

      {/* Zone principale */}
      <div style={{ minHeight: "260px" }}>

        {/* Scanner actif */}
        {scanning && (
          <motion.div key="scanner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ borderRadius: "16px", overflow: "hidden", border: `1px solid ${zoneBorder}` }}>
            <div id="qr-reader" style={{ width: "100%" }} />
          </motion.div>
        )}

        {/* Chargement */}
        {!scanning && loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              height: "260px", borderRadius: "16px",
              background: zoneBg, border: `1px solid ${zoneBorder}`,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "16px",
            }}
          >
            <span style={{
              width: "40px", height: "40px",
              border: "3px solid var(--auth-method-border)",
              borderTopColor: "#3b7ef8",
              borderRadius: "50%", display: "inline-block",
              animation: "spin 0.8s linear infinite",
            }} />
            <span style={{ color: "var(--auth-card-sub)", fontSize: "0.875rem" }}>
              Vérification en cours…
            </span>
          </motion.div>
        )}

        {/* Succès */}
        {!scanning && !loading && scanned && !error && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{
              height: "260px", borderRadius: "16px",
              background: "rgba(22, 163, 74, 0.06)",
              border: "1px solid rgba(22, 163, 74, 0.2)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "16px",
            }}
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              style={{
                width: "68px", height: "68px", borderRadius: "50%",
                background: "rgba(22, 163, 74, 0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
            <span style={{ color: "#16a34a", fontSize: "0.9rem", fontWeight: 600 }}>
              QR code reconnu
            </span>
          </motion.div>
        )}

        {/* Idle — bouton scanner */}
        {!scanning && !loading && !scanned && (
          <motion.button key="idle"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.98 }}
            onClick={() => { setError(null); setScanning(true); }}
            style={{
              width: "100%", height: "260px",
              borderRadius: "16px",
              border: "1.5px dashed var(--auth-method-featured-border)",
              background: "var(--auth-method-featured-bg)",
              cursor: "pointer",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "18px",
              transition: "all 0.2s ease",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <div style={{
              width: "76px", height: "76px", borderRadius: "50%",
              background: "var(--auth-icon-featured-bg)",
              border: "1px solid var(--auth-icon-featured-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--auth-icon-featured-color)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h3v3h-3z M17 17h3v3h-3z M14 20h3" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
              <span style={{ color: "var(--auth-method-title)", fontSize: "0.9rem", fontWeight: 600 }}>
                Scanner mon badge
              </span>
              <span style={{ color: "var(--auth-method-desc)", fontSize: "0.78rem" }}>
                Appuyez pour activer la caméra
              </span>
            </div>
          </motion.button>
        )}
      </div>

      {/* Erreur */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              padding: "12px 16px", borderRadius: "12px",
              background: "rgba(220, 38, 38, 0.06)",
              border: "1px solid rgba(220, 38, 38, 0.18)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p style={{ color: "#dc2626", fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Réessayer */}
      {error && (
        <button
          onClick={() => { setError(null); setScanned(false); setScanning(true); }}
          style={{
            width: "100%", padding: "10px 16px",
            borderRadius: "10px",
            background: "var(--auth-method-featured-bg)",
            border: "1px solid var(--auth-method-featured-border)",
            color: "var(--auth-icon-featured-color)",
            fontSize: "0.875rem", fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            transition: "all 0.15s",
          }}
        >
          Réessayer le scan
        </button>
      )}
    </div>
  );
}