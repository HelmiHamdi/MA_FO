"use client";
// src/app/(app)/discovery/profile/[id]/page.tsx
// Vue détail d'un profil depuis le mode View All (module 3.2)

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { discoveryApi } from "@/lib/api";
import { getInitials, getFullName, parseTags } from "@/lib/utils";
import toast from "react-hot-toast";

export default function DiscoveryProfilePage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const targetId = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["discovery-profile", targetId],
    queryFn: () => discoveryApi.getProfile(targetId).then((r) => r.data),
    enabled: !!targetId,
    staleTime: 60_000,
  });

  const connectMutation = useMutation({
    mutationFn: () => discoveryApi.sendConnectionRequest(targetId),
    onSuccess: () => {
      toast.success("Demande de connexion envoyée !");
      qc.invalidateQueries({ queryKey: ["discovery-profile", targetId] });
      qc.invalidateQueries({ queryKey: ["view-all"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Erreur lors de l'envoi";
      toast.error(msg);
    },
  });

  if (isLoading) return <ProfileSkeleton />;

  if (error || !data) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "4rem 1rem", gap: "1rem", color: "#ef4444",
      }}>
        <span style={{ fontSize: "2rem" }}>⚠️</span>
        <p style={{ fontSize: "0.875rem" }}>Profil introuvable.</p>
        <button onClick={() => router.back()} style={{
          padding: "0.5rem 1.25rem", borderRadius: "8px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "var(--text-muted, #94a3b8)", cursor: "pointer", fontSize: "0.875rem",
        }}>
          ← Retour
        </button>
      </div>
    );
  }

  const tags = parseTags(data.tags);
  const isConnected = data.connectionStatus === "ACCEPTED" || data.connectionStatus === "CONNECTED";
  const isPending = data.connectionStatus === "PENDING" || data.connectionStatus === "REQUEST_SENT";

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "1.25rem 1.25rem 6rem" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <button onClick={() => router.back()} style={{
          width: "38px", height: "38px", borderRadius: "10px",
          background: "var(--glass-bg, rgba(255,255,255,0.05))",
          border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
          color: "var(--text-muted, #94a3b8)", fontSize: "1.125rem",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>

        {/* Si déjà connecté, lien vers la conversation */}
        {isConnected && data.connectionId && (
          <Link href={`/connections/${data.connectionId}`} style={{
            fontSize: "0.8rem", fontWeight: 600, color: "#059669",
            padding: "6px 14px", borderRadius: "10px",
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.22)",
            textDecoration: "none",
          }}>
            Voir la connexion →
          </Link>
        )}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* Hero */}
        <div style={{ display: "flex", gap: "1.125rem", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div style={{
            position: "relative", width: "100px", height: "100px",
            borderRadius: "22px", overflow: "hidden", flexShrink: 0,
            background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {data.photoUrl ? (
              <Image src={data.photoUrl} alt={getFullName(data.firstName, data.lastName)}
                fill sizes="100px" style={{ objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: "2rem", fontWeight: 700, color: "white" }}>
                {getInitials(data.firstName, data.lastName)}
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: "4px" }}>
            <h1 style={{
              fontSize: "1.3125rem", fontWeight: 700, letterSpacing: "-0.02em",
              color: "var(--text-primary, #f1f5f9)", margin: "0 0 4px",
            }}>
              {getFullName(data.firstName, data.lastName)}
            </h1>
            {data.jobTitle && (
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary, #cbd5e1)", margin: "0 0 2px" }}>
                {data.jobTitle}
              </p>
            )}
            {data.company && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted, #94a3b8)", margin: "0 0 2px" }}>
                🏢 {data.company}
              </p>
            )}
            {data.country && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted, #94a3b8)", margin: 0 }}>
                📍 {data.country}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.625rem", marginBottom: "1.25rem" }}>
          {isConnected ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              padding: "0.625rem 1.125rem", borderRadius: "12px",
              background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.22)",
              color: "#059669", fontSize: "0.875rem", fontWeight: 600,
            }}>
              ✓ Connecté
            </span>
          ) : isPending ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              padding: "0.625rem 1.125rem", borderRadius: "12px",
              background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.22)",
              color: "#d97706", fontSize: "0.875rem", fontWeight: 600,
            }}>
              ⏳ Demande envoyée
            </span>
          ) : (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                padding: "0.625rem 1.125rem", borderRadius: "12px",
                background: "var(--brand-500, #7c3aed)", color: "white",
                border: "none", fontSize: "0.875rem", fontWeight: 600,
                cursor: connectMutation.isPending ? "not-allowed" : "pointer",
                opacity: connectMutation.isPending ? 0.6 : 1,
                transition: "all 0.15s",
              }}
            >
              {connectMutation.isPending ? "Envoi…" : "+ Connecter"}
            </button>
          )}

          {data.linkedinUrl && (
            <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              padding: "0.625rem 1.125rem", borderRadius: "12px",
              background: "rgba(10,102,194,0.1)", border: "1px solid rgba(10,102,194,0.22)",
              color: "#0a66c2", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none",
            }}>
              🔗 LinkedIn
            </a>
          )}
        </div>

        {/* AI compatibility */}
        {data.aiCompatibility && (
          <div style={{
            background: "rgba(124,58,237,0.05)", border: "1px solid rgba(139,92,246,0.15)",
            borderRadius: "18px", padding: "1rem 1.125rem", marginBottom: "0.875rem",
          }}>
            <p style={{
              fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--brand-400, #a78bfa)", margin: "0 0 6px",
            }}>✨ Compatibilité IA</p>
            <p style={{
              fontSize: "0.875rem", color: "var(--text-secondary, #cbd5e1)",
              lineHeight: 1.65, margin: 0, fontStyle: "italic",
            }}>
              {data.aiCompatibility}
            </p>
          </div>
        )}

        {/* Bio */}
        {data.bio && (
          <div style={{
            background: "var(--glass-bg, rgba(255,255,255,0.04))",
            border: "1px solid var(--border-subtle, rgba(255,255,255,0.07))",
            borderRadius: "18px", padding: "1rem 1.125rem", marginBottom: "0.875rem",
          }}>
            <p style={{
              fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--brand-400, #a78bfa)", margin: "0 0 6px",
            }}>À propos</p>
            <p style={{
              fontSize: "0.875rem", color: "var(--text-secondary, #cbd5e1)",
              lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap",
            }}>
              {data.bio}
            </p>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div style={{
            background: "var(--glass-bg, rgba(255,255,255,0.04))",
            border: "1px solid var(--border-subtle, rgba(255,255,255,0.07))",
            borderRadius: "18px", padding: "1rem 1.125rem", marginBottom: "0.875rem",
          }}>
            <p style={{
              fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--brand-400, #a78bfa)", margin: "0 0 10px",
            }}>Domaines d'intérêt</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {tags.map((tag) => (
                <span key={tag} style={{
                  padding: "4px 10px", borderRadius: "20px",
                  background: "rgba(124,58,237,0.1)", border: "1px solid rgba(139,92,246,0.18)",
                  color: "#c4b5fd", fontSize: "0.75rem", fontWeight: 500,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Info grid */}
        <div style={{
          background: "var(--glass-bg, rgba(255,255,255,0.04))",
          border: "1px solid var(--border-subtle, rgba(255,255,255,0.07))",
          borderRadius: "18px", padding: "1rem 1.125rem", marginBottom: "0.875rem",
        }}>
          <p style={{
            fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--brand-400, #a78bfa)", margin: "0 0 6px",
          }}>Informations</p>
          {[
            data.sector && { icon: "🏭", label: "Secteur", value: data.sector },
            data.jobTitle && { icon: "💼", label: "Poste", value: data.jobTitle },
            data.company && { icon: "🏢", label: "Entreprise", value: data.company },
            data.country && { icon: "📍", label: "Pays", value: data.country },
            data.profileType && { icon: "🏷️", label: "Type", value: data.profileType },
          ].filter(Boolean).map((row: any) => (
            <div key={row.label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", gap: "1rem",
            }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted, #94a3b8)" }}>
                {row.icon} {row.label}
              </span>
              <span style={{
                fontSize: "0.8rem", fontWeight: 500,
                color: "var(--text-secondary, #cbd5e1)",
                textAlign: "right", maxWidth: "60%",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* LinkedIn block */}
        {data.linkedinConnected && data.linkedinUrl && (
          <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", gap: "0.875rem",
            background: "rgba(10,102,194,0.08)", border: "1px solid rgba(10,102,194,0.18)",
            borderRadius: "16px", padding: "14px 16px", textDecoration: "none",
          }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: "#0a66c2", color: "white", fontSize: "1.125rem",
              fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>in</div>
            <div>
              <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary, #f1f5f9)", margin: "0 0 2px" }}>
                {getFullName(data.firstName, data.lastName)}
              </p>
              <p style={{ fontSize: "0.78rem", color: "#0a66c2", margin: 0 }}>
                Voir le profil LinkedIn →
              </p>
            </div>
          </a>
        )}
      </motion.div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div style={{ padding: "1.25rem", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ height: "38px", width: "38px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", marginBottom: "1.25rem" }} />
      <div style={{ display: "flex", gap: "1.125rem", marginBottom: "1.25rem" }}>
        <div style={{ width: "100px", height: "100px", borderRadius: "22px", background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          {[120, 90, 70].map((w, i) => (
            <div key={i} style={{ height: "14px", width: `${w}px`, borderRadius: "6px", background: "rgba(255,255,255,0.06)", marginBottom: "8px" }} />
          ))}
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: "80px", borderRadius: "18px", background: "rgba(255,255,255,0.06)", marginBottom: "0.875rem" }} />
      ))}
    </div>
  );
}