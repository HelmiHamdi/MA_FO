"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { meetingsApi } from "@/lib/api";
import { AgendaItem } from "@/types";
import toast from "react-hot-toast";

interface Props {
  meeting: AgendaItem;
  onClose: () => void;
}

type ScanState = "idle" | "scanning" | "loading" | "success" | "error";

let instanceCounter = 0;

export default function TableQrModal({ meeting, onClose }: Props) {
  const qc = useQueryClient();
  const domId = useRef(`qr-region-${++instanceCounter}`);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [isHttpWarning, setIsHttpWarning] = useState(false);

  const scannerRef = useRef<any>(null);
  const scannedRef = useRef(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isSecure =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!isSecure) setIsHttpWarning(true);
  }, []);

  // ── Mutation ───────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (qrToken: string) =>
      meetingsApi.confirmTableQr(meeting.id, qrToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      setScanState("success");
      setTimeout(() => {
        toast.success("🎉 Présence confirmée ! Bonne réunion !");
        onClose();
      }, 1500);
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "QR code invalide"
        : "Erreur de confirmation";
      setErrorMsg(msg);
      setScanState("error");
    },
  });

  // ── Stop camera ────────────────────────────────────────────────────────────
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear?.();
      } catch {
        // already stopped — ignore
      }
      scannerRef.current = null;
    }
  }, []);

  // ── Start camera ───────────────────────────────────────────────────────────
  const startCamera = useCallback(
    async (container: HTMLDivElement) => {
      scannedRef.current = false;
      setCameraError("");

      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        let cameras: { id: string; label: string }[] = [];
        try {
          cameras = await Html5Qrcode.getCameras();
        } catch (permErr: any) {
          const m = String(permErr?.message ?? permErr);
          setCameraError(
            /NotAllowed|Permission/i.test(m)
              ? "Accès à la caméra refusé. Cliquez sur 🔒 dans la barre d'adresse, autorisez la caméra, puis réessayez."
              : "Impossible d'accéder à la caméra : " + m,
          );
          setScanState("idle");
          return;
        }

        if (!cameras.length) {
          setCameraError("Aucune caméra détectée sur cet appareil.");
          setScanState("idle");
          return;
        }

        await stopCamera();

        const scanner = new Html5Qrcode(container.id, { verbose: false });
        scannerRef.current = scanner;

        const cam =
          cameras.find((c) => /back|rear|environment/i.test(c.label)) ??
          cameras[0];

        await scanner.start(
          cam.id,
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText: string) => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            await stopCamera();
            setScanState("loading");
            mutation.mutate(decodedText);
          },
          () => {},
        );
      } catch (err: any) {
        const m = String(err?.message ?? err);
        let friendly = "Impossible d'accéder à la caméra.";
        if (/NotAllowed|Permission/i.test(m)) {
          friendly = "Accès refusé. Autorisez la caméra dans les réglages du navigateur, puis réessayez.";
        } else if (/NotFound|not found/i.test(m)) {
          friendly = "Aucune caméra trouvée sur cet appareil.";
        } else if (/NotReadable|in use/i.test(m)) {
          friendly = "Caméra déjà utilisée par une autre application. Fermez-la et réessayez.";
        } else if (/https|secure|insecure/i.test(m)) {
          friendly = "La caméra nécessite HTTPS.";
        }
        setCameraError(friendly);
        setScanState("idle");
      }
    },
    [stopCamera, mutation],
  );

  // ── Callback ref — fires exactly when DOM node is ready ───────────────────
  const onVideoContainerMount = useCallback(
    (node: HTMLDivElement | null) => {
      (videoContainerRef as any).current = node;
      if (node && scanState === "scanning") {
        startCamera(node);
      }
    },
    [scanState, startCamera],
  );

  // ── Global cleanup on unmount ──────────────────────────────────────────────
  useEffect(() => () => { stopCamera(); }, []); // eslint-disable-line

  const handleRetry = () => {
    setErrorMsg("");
    scannedRef.current = false;
    setScanState("idle");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "520px",
          background: "var(--surface-1, #0f0f1a)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "28px 28px 0 0",
          padding: "1.25rem 1.5rem 3rem",
          boxShadow: "0 -8px 64px rgba(0,0,0,0.5)",
          maxHeight: "92vh", overflowY: "auto",
        }}
      >
        {/* Handle */}
        <div style={{
          width: "40px", height: "4px", borderRadius: "2px",
          background: "rgba(255,255,255,0.15)", margin: "0 auto 1.25rem",
        }} />

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", marginBottom: "1rem",
        }}>
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#f1f5f9", margin: "0 0 4px" }}>
              Confirmer la présence
            </h3>
            {meeting.table && (
              <p style={{ fontSize: "0.8125rem", color: "#94a3b8", margin: 0 }}>
                Table assignée :{" "}
                <strong style={{ color: "#a78bfa" }}>
                  Table {meeting.table.number} · {meeting.table.room}
                </strong>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px", height: "32px", borderRadius: "8px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#94a3b8", cursor: "pointer", fontSize: "0.875rem",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>

        {/* HTTPS warning */}
        {isHttpWarning && (
          <div style={{
            marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "12px",
            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
            display: "flex", gap: "0.5rem",
          }}>
            <span style={{ flexShrink: 0 }}>🔒</span>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#fbbf24", lineHeight: 1.5 }}>
              La caméra nécessite HTTPS. En développement, utilisez{" "}
              <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 4px", borderRadius: 4 }}>
                localhost
              </code>{" "}
              (pas une IP réseau).
            </p>
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div style={{
            marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "12px",
            background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
            display: "flex", gap: "0.5rem",
          }}>
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#fca5a5", lineHeight: 1.5 }}>
              {cameraError}
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* ── SUCCESS ── */}
          {scanState === "success" && (
            <motion.div key="success"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "2.5rem 1rem", gap: "0.5rem", textAlign: "center",
              }}
            >
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.1 }}
                style={{ fontSize: "3rem" }}
              >✅</motion.span>
              <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#f1f5f9", margin: "0.5rem 0 0" }}>
                Présence confirmée !
              </p>
              <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>Bonne réunion 🎉</p>
            </motion.div>
          )}

          {/* ── LOADING ── */}
          {scanState === "loading" && (
            <motion.div key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "2.5rem 1rem", gap: "0.75rem",
              }}
            >
              <span style={{
                width: "40px", height: "40px",
                border: "3px solid rgba(167,139,250,0.2)",
                borderTopColor: "#a78bfa", borderRadius: "50%",
                display: "inline-block", animation: "spin 0.7s linear infinite",
              }} />
              <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Vérification en cours…</span>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {scanState === "error" && (
            <motion.div key="error"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "2rem 1rem", gap: "0.5rem", textAlign: "center",
              }}
            >
              <span style={{ fontSize: "2.5rem" }}>❌</span>
              <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#ef4444", margin: "0.5rem 0 0" }}>
                QR invalide
              </p>
              <p style={{ fontSize: "0.8125rem", color: "#94a3b8", maxWidth: "280px", lineHeight: 1.5, margin: "0.25rem 0 1rem" }}>
                {errorMsg}
              </p>
              <button onClick={handleRetry} style={{
                padding: "0.625rem 1.5rem", borderRadius: "10px",
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
                color: "#ef4444", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
              }}>Réessayer</button>
            </motion.div>
          )}

          {/* ── SCANNING ── */}
          {scanState === "scanning" && (
            <motion.div key="scanning"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden", background: "#000" }}>
                <div
                  id={domId.current}
                  ref={onVideoContainerMount}
                  style={{ width: "100%", minHeight: "300px" }}
                />
                {/* Viewfinder corners + scan line */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {[
                    { top: 14, left: 14, borderTop: "3px solid #a78bfa", borderLeft: "3px solid #a78bfa" },
                    { top: 14, right: 14, borderTop: "3px solid #a78bfa", borderRight: "3px solid #a78bfa" },
                    { bottom: 14, left: 14, borderBottom: "3px solid #a78bfa", borderLeft: "3px solid #a78bfa" },
                    { bottom: 14, right: 14, borderBottom: "3px solid #a78bfa", borderRight: "3px solid #a78bfa" },
                  ].map((s, i) => (
                    <div key={i} style={{ position: "absolute", width: "22px", height: "22px", borderRadius: "2px", ...s }} />
                  ))}
                  <div style={{
                    position: "absolute", left: "15%", right: "15%", height: "2px",
                    background: "linear-gradient(90deg, transparent, #a78bfa, transparent)",
                    animation: "scanLine 2s ease-in-out infinite",
                  }} />
                </div>
              </div>

              <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>
                Pointez vers le QR code sur la table
              </p>

              <button
                onClick={async () => { await stopCamera(); setScanState("idle"); }}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#94a3b8", borderRadius: "10px",
                  padding: "0.625rem", fontSize: "0.875rem",
                  cursor: "pointer", width: "100%",
                }}
              >Arrêter</button>
            </motion.div>
          )}

          {/* ── IDLE ── */}
          {scanState === "idle" && (
            <motion.div key="idle"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            >
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
                onClick={() => setScanState("scanning")}
                style={{
                  width: "100%", borderRadius: "18px",
                  border: "2px dashed rgba(139,92,246,0.35)",
                  background: "rgba(124,58,237,0.06)",
                  padding: "2.25rem 1.5rem",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: "0.75rem", cursor: "pointer",
                }}
              >
                <div style={{ position: "relative", width: "64px", height: "64px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "2.5rem", position: "relative", zIndex: 1 }}>📷</span>
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "rgba(139,92,246,0.15)",
                    animation: "pulseRing 2s ease infinite",
                  }} />
                </div>
                <p style={{ fontSize: "1rem", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
                  Ouvrir la caméra
                </p>
                <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0, textAlign: "center" }}>
                  Scannez le QR code posé sur votre table
                </p>
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulseRing {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.3); opacity: 0; }
          }
          @keyframes scanLine {
            0%   { top: 15%; }
            50%  { top: 80%; }
            100% { top: 15%; }
          }
          [id^="qr-region-"] video {
            width: 100% !important;
            border-radius: 12px !important;
            object-fit: cover !important;
          }
          [id^="qr-region-"] img,
          [id^="qr-region-"] select,
          [id^="qr-region-"] button,
          [id^="qr-region-"] span[id*="status"],
          [id^="qr-region-"] div[id*="shaded"] { display: none !important; }
        `}</style>
      </motion.div>
    </motion.div>
  );
}