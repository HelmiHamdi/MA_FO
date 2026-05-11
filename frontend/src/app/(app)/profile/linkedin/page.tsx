"use client";
// src/app/(app)/profile/linkedin/page.tsx
// Module — LinkedIn OAuth Connect / Disconnect
// Gère : initiation OAuth, callback (code+state), état connecté, déconnexion

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { profileApi, api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";
import axios from "axios";

// ─── LinkedIn OAuth helpers ───────────────────────────────────────────────────
const LINKEDIN_OAUTH_INIT = "/profile/linkedin/oauth/init";
const LINKEDIN_OAUTH_CALLBACK = "/profile/linkedin/oauth/callback";
const LINKEDIN_DISCONNECT = "/profile/linkedin/disconnect";

const linkedinApi = {
  /** Récupère l'URL OAuth LinkedIn depuis le backend */
  getAuthUrl: () => api.get<{ authUrl: string; state: string }>(LINKEDIN_OAUTH_INIT),

  /** Échange le code contre les tokens (appelé par la page après redirect) */
  handleCallback: (code: string, state: string) =>
    api.post<{ participant: any }>(LINKEDIN_OAUTH_CALLBACK, { code, state }),

  /** Déconnecte LinkedIn */
  disconnect: () => api.post(LINKEDIN_DISCONNECT),
};

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function Spinner({ size = 18, color = "white" }: { size?: number; color?: string }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      border: `2px solid ${color}30`, borderTopColor: color,
      animation: "li-spin 0.7s linear infinite", flexShrink: 0,
    }}>
      <style>{`@keyframes li-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function BenefitRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <span style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: "rgba(10,102,194,0.12)", border: "1px solid rgba(10,102,194,0.20)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
      }}>{icon}</span>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary, #cbd5e1)", lineHeight: 1.5 }}>
        {text}
      </p>
    </div>
  );
}

// ─── Status states ─────────────────────────────────────────────────────────────
type PageState =
  | "idle"           // page normale, pas connecté
  | "loading_url"    // récupération URL OAuth
  | "redirecting"    // on va chez LinkedIn
  | "callback"       // on traite le code OAuth
  | "connected"      // déjà connecté (vient du profil)
  | "disconnecting"  // suppression du token
  | "error";         // erreur quelconque

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function LinkedInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { participant, updateParticipant } = useAuthStore();

  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Fetch profil frais pour savoir si déjà connecté ──────────────────────
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["profile-me"],
    queryFn: () => profileApi.getMe().then((r) => r.data.participant),
    staleTime: 30_000,
    initialData: participant ?? undefined,
  });

  const p = profileData ?? participant;
  const isConnected = !!(p as any)?.linkedinConnected;

  // ── Détecter un callback OAuth (présence de ?code=...&state=...) ──────────
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setErrorMsg(
        error === "access_denied"
          ? "Vous avez refusé l'autorisation LinkedIn."
          : `Erreur LinkedIn : ${error}`,
      );
      setPageState("error");
      // Nettoyer l'URL
      router.replace("/profile/linkedin");
      return;
    }

    if (code && state) {
      setPageState("callback");
      linkedinApi
        .handleCallback(code, state)
        .then(({ data }) => {
          updateParticipant(data.participant);
          qc.invalidateQueries({ queryKey: ["profile-me"] });
          setPageState("connected");
          toast.success("LinkedIn connecté avec succès ! 🎉");
          // Nettoyer l'URL
          router.replace("/profile/linkedin");
        })
        .catch((err: unknown) => {
          const msg = axios.isAxiosError(err)
            ? (err.response?.data?.message ?? "Erreur de connexion LinkedIn")
            : "Erreur inconnue";
          setErrorMsg(msg);
          setPageState("error");
          router.replace("/profile/linkedin");
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state si le profil dit "connecté"
  useEffect(() => {
    if (isConnected && pageState === "idle") {
      setPageState("connected");
    }
  }, [isConnected, pageState]);

  // ── Lancer OAuth ──────────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    setPageState("loading_url");
    try {
      const { data } = await linkedinApi.getAuthUrl();
      setPageState("redirecting");
      // Stocker le state pour validation CSRF côté backend (le backend le gère déjà via session/redis)
      window.location.href = data.authUrl;
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? "Impossible d'initier la connexion")
        : "Erreur réseau";
      setErrorMsg(msg);
      setPageState("error");
    }
  }, []);

  // ── Déconnecter ───────────────────────────────────────────────────────────
  const handleDisconnect = useCallback(async () => {
    if (!confirm("Déconnecter votre compte LinkedIn ? Vos données importées resteront sur votre profil.")) return;
    setPageState("disconnecting");
    try {
      await linkedinApi.disconnect();
      // Mettre à jour localement
      if (participant) {
        updateParticipant({ ...participant, linkedinConnected: false } as any);
      }
      qc.invalidateQueries({ queryKey: ["profile-me"] });
      setPageState("idle");
      toast.success("LinkedIn déconnecté.");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? "Erreur lors de la déconnexion")
        : "Erreur inconnue";
      toast.error(msg);
      setPageState("connected");
    }
  }, [participant, updateParticipant, qc]);

  const isBusy =
    pageState === "loading_url" ||
    pageState === "redirecting" ||
    pageState === "callback" ||
    pageState === "disconnecting" ||
    profileLoading;

  return (
    <div style={{
      maxWidth: 520, margin: "0 auto",
      padding: "3.5rem 1.25rem 7rem",
      display: "flex", flexDirection: "column", gap: 20,
    }}>

      {/* ── Back + Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/profile" style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          textDecoration: "none", color: "var(--text-secondary, #cbd5e1)",
          fontSize: "1rem",
        }}>←</Link>
        <h1 style={{
          margin: 0, fontSize: "1.375rem", fontWeight: 800,
          letterSpacing: "-0.03em", color: "var(--text-primary, #f1f5f9)",
        }}>
          Connexion LinkedIn
        </h1>
      </motion.div>

      {/* ── LinkedIn hero card ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <div style={{
          borderRadius: 20, overflow: "hidden",
          border: pageState === "connected"
            ? "1px solid rgba(52,211,153,0.25)"
            : "1px solid rgba(10,102,194,0.25)",
          background: pageState === "connected"
            ? "rgba(52,211,153,0.05)"
            : "rgba(10,102,194,0.06)",
        }}>
          {/* Top bar */}
          <div style={{
            height: 3,
            background: pageState === "connected"
              ? "linear-gradient(90deg, #34d399, #10b981)"
              : "linear-gradient(90deg, #0A66C2, #0073b1, #00a0dc)",
          }} />

          <div style={{ padding: "20px 20px 22px" }}>
            {/* Logo + status */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              {/* LinkedIn logo */}
              <div style={{
                width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                background: "#0A66C2",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 16px rgba(10,102,194,0.35)",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "var(--text-primary, #f1f5f9)" }}>
                  LinkedIn
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                    background: pageState === "connected" ? "#34d399" : "rgba(255,255,255,0.2)",
                    boxShadow: pageState === "connected" ? "0 0 6px #34d399" : "none",
                  }} />
                  <span style={{ fontSize: "0.78rem", color: pageState === "connected" ? "#34d399" : "var(--text-muted, #94a3b8)" }}>
                    {pageState === "connected" ? "Compte connecté" : "Non connecté"}
                  </span>
                </div>
              </div>
            </div>

            {/* Callback / loading states */}
            <AnimatePresence mode="wait">
              {pageState === "callback" && (
                <motion.div key="callback"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 16px", borderRadius: 12,
                    background: "rgba(10,102,194,0.10)",
                    border: "1px solid rgba(10,102,194,0.20)",
                    marginBottom: 16,
                  }}>
                  <Spinner size={18} color="#60a5fa" />
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#93c5fd" }}>
                    Connexion en cours… Veuillez patienter.
                  </p>
                </motion.div>
              )}

              {pageState === "error" && errorMsg && (
                <motion.div key="error"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "14px 16px", borderRadius: 12,
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.20)",
                    marginBottom: 16,
                  }}>
                  <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>⚠️</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem", color: "#fca5a5" }}>
                      Échec de la connexion
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "#f87171" }}>
                      {errorMsg}
                    </p>
                  </div>
                </motion.div>
              )}

              {pageState === "connected" && (
                <motion.div key="connected-info"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 12,
                    background: "rgba(52,211,153,0.08)",
                    border: "1px solid rgba(52,211,153,0.18)",
                    marginBottom: 16,
                  }}>
                  <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>✅</span>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#6ee7b7", lineHeight: 1.4 }}>
                    Votre compte LinkedIn est lié. Vos données sont synchronisées avec votre profil.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTA button */}
            {pageState !== "callback" && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={pageState === "connected" ? handleDisconnect : handleConnect}
                disabled={isBusy}
                style={{
                  width: "100%", height: 48, borderRadius: 12,
                  fontWeight: 700, fontSize: "0.9375rem", cursor: isBusy ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  background: pageState === "connected"
                    ? "rgba(239,68,68,0.10)"
                    : isBusy ? "rgba(10,102,194,0.40)" : "#0A66C2",
                  color: pageState === "connected" ? "#f87171" : "white",
                  border: pageState === "connected" ? "1px solid rgba(239,68,68,0.25)" : "none",
                  boxShadow: pageState !== "connected" && !isBusy ? "0 4px 18px rgba(10,102,194,0.35)" : "none",
                  transition: "all 0.2s",
                }}
              >
                {isBusy ? (
                  <>
                    <Spinner size={16} color={pageState === "connected" ? "#f87171" : "white"} />
                    {pageState === "loading_url" && "Initialisation…"}
                    {pageState === "redirecting" && "Redirection vers LinkedIn…"}
                    {pageState === "disconnecting" && "Déconnexion…"}
                    {profileLoading && "Chargement…"}
                  </>
                ) : pageState === "connected" ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Déconnecter LinkedIn
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    Se connecter avec LinkedIn
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Benefits (masqué si déjà connecté) ── */}
      <AnimatePresence>
        {pageState !== "connected" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div style={{
              borderRadius: 18,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              padding: "18px 18px",
            }}>
              <p style={{
                margin: "0 0 14px", fontSize: "0.6rem", fontWeight: 700,
                letterSpacing: "0.15em", textTransform: "uppercase",
                color: "var(--brand-400, #a78bfa)",
              }}>
                Pourquoi connecter LinkedIn ?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <BenefitRow icon="📊" text="Import automatique de vos informations pro : poste, entreprise, secteur." />
                <BenefitRow icon="🎯" text="Améliore la précision du matching — vos suggestions deviennent plus pertinentes." />
                <BenefitRow icon="✨" text="Complète votre profil à 100% et booste votre score de visibilité." />
                <BenefitRow icon="🔒" text="Accès en lecture seule. Nous ne publions jamais en votre nom." />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Connected : données importées ── */}
      <AnimatePresence>
        {pageState === "connected" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div style={{
              borderRadius: 18,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              padding: "18px 18px",
            }}>
              <p style={{
                margin: "0 0 14px", fontSize: "0.6rem", fontWeight: 700,
                letterSpacing: "0.15em", textTransform: "uppercase",
                color: "var(--brand-400, #a78bfa)",
              }}>
                Données synchronisées
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Poste", value: (p as any)?.jobTitle },
                  { label: "Entreprise", value: (p as any)?.company },
                  { label: "Pays", value: (p as any)?.country },
                  { label: "URL LinkedIn", value: (p as any)?.linkedinUrl },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 12,
                    padding: "8px 12px", borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", fontWeight: 600, minWidth: 80 }}>
                      {label}
                    </span>
                    <span style={{
                      fontSize: "0.8125rem", color: value ? "var(--text-secondary, #cbd5e1)" : "var(--text-ghost, #475569)",
                      fontStyle: value ? "normal" : "italic",
                      textAlign: "right", wordBreak: "break-all",
                    }}>
                      {value ?? "—"}
                    </span>
                  </div>
                ))}
              </div>

              <Link href="/profile" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                marginTop: 14, padding: "10px", borderRadius: 10,
                background: "rgba(124,58,237,0.10)",
                border: "1px solid rgba(139,92,246,0.20)",
                color: "#a78bfa", fontWeight: 600, fontSize: "0.875rem",
                textDecoration: "none",
              }}>
                Voir mon profil complet →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Privacy notice ── */}
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        style={{
          margin: 0, fontSize: "0.7rem", textAlign: "center",
          color: "var(--text-ghost, #475569)", lineHeight: 1.5,
          padding: "0 8px",
        }}
      >
        🔒 Connexion sécurisée via OAuth 2.0. Nous accédons uniquement aux données de votre profil public LinkedIn.
        Vous pouvez révoquer l'accès à tout moment depuis{" "}
        <a href="https://www.linkedin.com/mypreferences/d/connected-apps" target="_blank" rel="noopener noreferrer"
          style={{ color: "#60a5fa", textDecoration: "none" }}>
          linkedin.com/mypreferences
        </a>.
      </motion.p>

    </div>
  );
}