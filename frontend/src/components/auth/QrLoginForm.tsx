"use client";
// src/components/auth/QrLoginForm.tsx
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

interface Html5QrcodeScannerInstance {
  render: (onSuccess: (text: string) => void, onError: () => void) => void;
  clear: () => Promise<void>;
}

export default function QrLoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const scannerRef = useRef<Html5QrcodeScannerInstance | null>(null);

  const startScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: 220 },
        false,
      );
      scannerRef.current = scanner;
      scanner.render(
        async (text: string) => {
          await scanner.clear();
          setScanning(false);
          setScanned(true);
          await loginWithToken(text);
        },
        () => {},
      );
    } catch {
      toast.error("Caméra non disponible");
      setScanning(false);
    }
  };

  const loginWithToken = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.loginWithQr(token);
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
        "QR invalide";
      setError(msg);
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      scannerRef.current?.clear?.().catch(() => {});
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">
          Scan QR Badge
        </h2>
        <p className="text-white/45 text-sm">
          Scannez le QR code imprimé sur votre badge d&apos;accès
        </p>
      </div>

      {/* Zone scanner */}
      {scanning ? (
        <div id="qr-reader" className="rounded-2xl overflow-hidden" />
      ) : loading ? (
        <div className="w-full aspect-square max-h-52 rounded-2xl border border-brand-400/30 flex flex-col items-center justify-center gap-3 bg-brand-500/5">
          <span className="w-10 h-10 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
          <span className="text-white/50 text-sm">Vérification en cours…</span>
        </div>
      ) : scanned && !error ? (
        <div className="w-full aspect-square max-h-52 rounded-2xl border border-emerald-400/30 flex flex-col items-center justify-center gap-3 bg-emerald-500/5">
          <span className="text-5xl">✅</span>
          <span className="text-emerald-300 text-sm">QR code reconnu</span>
        </div>
      ) : (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={startScan}
          className="w-full aspect-square max-h-52 rounded-2xl border-2 border-dashed border-brand-400/40 flex flex-col items-center justify-center gap-3 hover:border-brand-400/70 hover:bg-brand-500/10 transition-all"
        >
          <div className="w-16 h-16 rounded-2xl bg-brand-500/20 flex items-center justify-center text-3xl">
            📷
          </div>
          <span className="text-white/60 text-sm">
            Appuyez pour scanner votre badge
          </span>
        </motion.button>
      )}

      {/* Erreur inline */}
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

      {/* Réessayer après erreur */}
      {error && (
        <button
          onClick={() => { setError(null); startScan(); }}
          className="w-full text-center text-brand-400 text-sm hover:text-brand-300 transition-colors"
        >
          Réessayer le scan
        </button>
      )}
    </div>
  );
}