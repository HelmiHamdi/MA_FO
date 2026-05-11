"use client";
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.375rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
          className="text-white mb-1"
        >
          Scan QR Badge
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Scannez le QR code imprimé sur votre badge d&apos;accès
        </p>
      </div>

      {/* Zone principale */}
      <div style={{ minHeight: "280px" }}>

        {/* Scanner actif */}
        {scanning && (
          <motion.div
            key="scanner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ borderRadius: "16px", overflow: "hidden" }}
          >
            <div id="qr-reader" style={{ width: "100%" }} />
          </motion.div>
        )}

        {/* Chargement */}
        {!scanning && loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              height: "280px",
              borderRadius: "16px",
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(139,92,246,0.25)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            <span style={{
              width: "40px", height: "40px",
              border: "3px solid rgba(167,139,250,0.2)",
              borderTopColor: "#a78bfa",
              borderRadius: "50%",
              display: "inline-block",
              animation: "spin 0.8s linear infinite",
            }} />
            <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              Vérification en cours…
            </span>
          </motion.div>
        )}

        {/* Succès */}
        {!scanning && !loading && scanned && !error && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{
              height: "280px",
              borderRadius: "16px",
              background: "rgba(52,211,153,0.08)",
              border: "1px solid rgba(52,211,153,0.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              style={{
                width: "72px", height: "72px",
                borderRadius: "50%",
                background: "rgba(52,211,153,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2rem",
              }}
            >
              ✅
            </motion.div>
            <span style={{ color: "#34d399", fontSize: "0.9rem", fontWeight: 600 }}>
              QR code reconnu
            </span>
          </motion.div>
        )}

        {/* Idle — bouton scanner */}
        {!scanning && !loading && !scanned && (
          <motion.button
            key="idle"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            onClick={() => { setError(null); setScanning(true); }}
            style={{
              width: "100%",
              height: "280px",
              borderRadius: "16px",
              border: "2px dashed rgba(139,92,246,0.4)",
              background: "rgba(124,58,237,0.06)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",          // ← espace généreux entre icône et texte
              transition: "all 0.2s ease",
            }}
          >
            {/* Icône caméra dans un cercle */}
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(124,58,237,0.15)",
              border: "1.5px solid rgba(139,92,246,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.25rem",
              flexShrink: 0,
            }}>
              📷
            </div>

            {/* Textes groupés, bien séparés de l'icône */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <span style={{
                color: "var(--text-primary, #fff)",
                fontSize: "0.9rem",
                fontWeight: 600,
              }}>
                Scanner mon badge
              </span>
              <span style={{
                color: "var(--text-secondary)",
                fontSize: "0.8rem",
              }}>
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
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
            }}
          >
            <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: "1px" }}>⚠️</span>
            <p style={{ color: "#fca5a5", fontSize: "0.875rem", margin: 0, lineHeight: 1.5 }}>
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
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            background: "rgba(124,58,237,0.1)",
            border: "1px solid rgba(139,92,246,0.25)",
            color: "#a78bfa",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Réessayer le scan
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}