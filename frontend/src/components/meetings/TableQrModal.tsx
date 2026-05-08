"use client";
// src/components/meetings/TableQrModal.tsx
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { meetingsApi } from "@/lib/api";
import { AgendaItem } from "@/types";
import toast from "react-hot-toast";

interface Props { meeting: AgendaItem; onClose: () => void; }

interface Html5QrcodeScannerInstance {
  render: (onSuccess: (text: string) => void, onError: () => void) => void;
  clear: () => Promise<void>;
}

export default function TableQrModal({ meeting, onClose }: Props) {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const scannerRef = useRef<Html5QrcodeScannerInstance | null>(null);

  const mutation = useMutation({
    mutationFn: (qrToken: string) => meetingsApi.confirmTableQr(meeting.id, qrToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Présence confirmée ! Bonne réunion 🎉");
      onClose();
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "QR invalide"
        : "QR invalide";
      toast.error(msg);
    },
  });

  useEffect(() => {
    return () => { scannerRef.current?.clear?.().catch(() => {}); };
  }, []);

  const startScan = async () => {
    setScanning(true);
    try {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      const scanner = new Html5QrcodeScanner("table-qr-reader", { fps: 10, qrbox: 200 }, false);
      scannerRef.current = scanner;
      scanner.render(
        async (text: string) => { scanner.clear(); setScanning(false); mutation.mutate(text); },
        () => {}
      );
    } catch { toast.error("Caméra non disponible"); setScanning(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full max-w-lg glass-strong rounded-t-3xl p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-1">Scanner la table</h3>
        {meeting.table && (
          <p className="text-brand-300 text-sm mb-5">Table {meeting.table.number} · {meeting.table.room}</p>
        )}

        {!scanning ? (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={startScan}
            className="w-full h-40 rounded-2xl border-2 border-dashed border-brand-400/40 flex flex-col items-center justify-center gap-3 hover:border-brand-400/70 hover:bg-brand-500/10 transition-all mb-5"
          >
            <span className="text-4xl">📷</span>
            <span className="text-white/50 text-sm">Activer la caméra</span>
          </motion.button>
        ) : (
          <div id="table-qr-reader" className="rounded-2xl overflow-hidden mb-5" />
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Token QR manuel…"
            className="input-glass flex-1 text-sm font-mono"
          />
          <button
            onClick={() => mutation.mutate(manualToken)}
            disabled={!manualToken || mutation.isPending}
            className="btn-primary px-4 disabled:opacity-40"
          >
            ✓
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}