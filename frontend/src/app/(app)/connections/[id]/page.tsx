"use client";
// src/app/(app)/connections/[id]/page.tsx
// Module 4.2 — Connection Profile View

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { connectionsApi } from "@/lib/api";
import { getInitials, getFullName, formatDate, formatTime, parseTags } from "@/lib/utils";
import { MeetingStatus } from "@/types";

// ─── Meeting Status Banner ─────────────────────────────────────────────────────

function MeetingStatusBanner({
  meetingStatus,
  meetingId,
  connectionId,
  meeting,
}: {
  meetingStatus: string;
  meetingId?: string | null;
  connectionId: string;
  meeting?: any;
}) {
  if (meetingStatus === "NONE" || !meetingStatus) return null;

  const configs: Record<string, { bg: string; border: string; icon: string; label: string; color: string }> = {
    PENDING: {
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.2)",
      icon: "⏳",
      label: "Demande de réunion en attente",
      color: "#d97706",
    },
    CONFIRMED: {
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.2)",
      icon: "✅",
      label: "Réunion confirmée",
      color: "#059669",
    },
    COMPLETED: {
      bg: "rgba(99,102,241,0.08)",
      border: "rgba(99,102,241,0.2)",
      icon: "☑️",
      label: "Réunion terminée",
      color: "#4f46e5",
    },
    CANCELLED: {
      bg: "rgba(239,68,68,0.08)",
      border: "rgba(239,68,68,0.2)",
      icon: "✕",
      label: "Réunion annulée",
      color: "#dc2626",
    },
  };

  const conf = configs[meetingStatus];
  if (!conf) return null;

  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: "14px",
        background: conf.bg,
        border: `1px solid ${conf.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        marginBottom: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "1.125rem" }}>{conf.icon}</span>
        <div>
          <p style={{ fontSize: "0.8rem", fontWeight: 700, color: conf.color, margin: "0 0 2px" }}>
            {conf.label}
          </p>
          {meeting?.slot && (
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", margin: 0 }}>
              {formatDate(meeting.slot.startTime)} · {formatTime(meeting.slot.startTime)} — {formatTime(meeting.slot.endTime)}
              {meeting.table ? ` · Table ${meeting.table.number}, ${meeting.table.room}` : ""}
            </p>
          )}
        </div>
      </div>
      {meetingId && (
        <Link
          href="/meetings"
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            color: conf.color,
            textDecoration: "none",
            padding: "4px 10px",
            borderRadius: "6px",
            background: conf.bg,
            border: `1px solid ${conf.border}`,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Voir l&apos;agenda →
        </Link>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnectionProfilePage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["connection-profile", connectionId],
    queryFn: () => connectionsApi.getProfile(connectionId).then((r) => r.data),
    enabled: !!connectionId,
    staleTime: 60_000,
  });

  if (isLoading) return <ProfileSkeleton />;
  if (error || !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4rem 1rem", gap: "1rem", color: "#ef4444" }}>
        <span style={{ fontSize: "2rem" }}>⚠️</span>
        <p style={{ fontSize: "0.875rem" }}>Connexion introuvable.</p>
        <button onClick={() => router.back()} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted, #94a3b8)", cursor: "pointer", fontSize: "0.875rem" }}>
          ← Retour
        </button>
      </div>
    );
  }

  const {
    connection,
    participant,
    meetingHistory = [],
    currentMeeting,
  } = data;

  const tags = parseTags(participant?.tags);
  const meetingStatus = connection?.meetingStatus ?? "NONE";
  const hasMeetingOngoing = ["PENDING", "CONFIRMED"].includes(meetingStatus);

  return (
    <div className="page-wrapper">
      {/* ── Top bar ── */}
      <div className="top-bar">
        <button onClick={() => router.back()} className="back-btn" aria-label="Retour">
          ←
        </button>
        {connection?.conversationId && (
          <Link href={`/chat/${connection.conversationId}`} className="chat-icon-btn" aria-label="Ouvrir le chat">
            💬
          </Link>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* ── Hero ── */}
        <div className="hero">
          <div className="hero-avatar">
            {participant?.photoUrl ? (
              <Image
                src={participant.photoUrl}
                alt={getFullName(participant.firstName, participant.lastName)}
                fill
                sizes="100px"
                className="object-cover"
              />
            ) : (
              <span className="hero-initials">
                {getInitials(participant?.firstName, participant?.lastName)}
              </span>
            )}
          </div>

          <div className="hero-info">
            <h1 className="hero-name">
              {getFullName(participant?.firstName, participant?.lastName)}
            </h1>
            {participant?.jobTitle && (
              <p className="hero-job">{participant.jobTitle}</p>
            )}
            {participant?.company && (
              <p className="hero-company">🏢 {participant.company}</p>
            )}
            {participant?.country && (
              <p className="hero-country">📍 {participant.country}</p>
            )}
          </div>
        </div>

        {/* ── Meeting status banner ── */}
        <MeetingStatusBanner
          meetingStatus={meetingStatus}
          meetingId={connection?.meetingId}
          connectionId={connectionId}
          meeting={currentMeeting}
        />

        {/* ── Action buttons ── */}
        <div className="actions-row">
          {/* Message */}
          {connection?.conversationId && (
            <Link href={`/chat/${connection.conversationId}`} className="btn-action btn-message">
              💬 Message
            </Link>
          )}

          {/* Meeting CTA: depends on status */}
          {!hasMeetingOngoing ? (
            <Link
              href={`/meetings/request?receiverId=${participant?.id}&name=${encodeURIComponent(getFullName(participant?.firstName, participant?.lastName))}`}
              className="btn-action btn-meeting"
            >
              📅 Demander une réunion
            </Link>
          ) : meetingStatus === "PENDING" ? (
            <Link href="/meetings" className="btn-action btn-meeting-pending">
              ⏳ Réunion en attente
            </Link>
          ) : (
            <Link href="/meetings" className="btn-action btn-meeting-confirmed">
              ✅ Réunion confirmée
            </Link>
          )}

          {/* LinkedIn */}
          {participant?.linkedinUrl && (
            <a
              href={participant.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-action btn-linkedin"
            >
              🔗 LinkedIn
            </a>
          )}
        </div>

        {/* ── AI Explanation ── */}
        {connection?.aiExplanation && (
          <div className="section-card ai-section">
            <p className="section-label">✨ Compatibilité IA</p>
            <p className="ai-text">{connection.aiExplanation}</p>
          </div>
        )}

        {/* ── Bio ── */}
        {participant?.bio && (
          <div className="section-card">
            <p className="section-label">À propos</p>
            <p className="bio-text">{participant.bio}</p>
          </div>
        )}

        {/* ── Tags ── */}
        {tags.length > 0 && (
          <div className="section-card">
            <p className="section-label">Domaines d&apos;intérêt</p>
            <div className="tags-row">
              {tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Info grid ── */}
        <div className="section-card">
          <p className="section-label">Informations</p>
          <div className="info-grid">
            {participant?.sector && (
              <InfoRow icon="🏭" label="Secteur" value={participant.sector} />
            )}
            {participant?.jobTitle && (
              <InfoRow icon="💼" label="Poste" value={participant.jobTitle} />
            )}
            {participant?.company && (
              <InfoRow icon="🏢" label="Entreprise" value={participant.company} />
            )}
            {participant?.country && (
              <InfoRow icon="📍" label="Pays" value={participant.country} />
            )}
            {participant?.linkedinConnected && (
              <InfoRow icon="🔗" label="LinkedIn" value="Profil connecté" accent />
            )}
          </div>
        </div>

        {/* ── Meeting history ── */}
        {meetingHistory.length > 0 && (
          <div className="section-card">
            <p className="section-label">Historique des réunions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {meetingHistory.map((m: any) => (
                <MeetingHistoryItem key={m.id} meeting={m} />
              ))}
            </div>
          </div>
        )}

        {/* ── LinkedIn block ── */}
        {participant?.linkedinConnected && participant?.linkedinUrl && (
          <a
            href={participant.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="linkedin-block"
          >
            <div className="linkedin-logo">in</div>
            <div>
              <p className="linkedin-name">
                {getFullName(participant.firstName, participant.lastName)}
              </p>
              <p className="linkedin-sub">Voir le profil LinkedIn →</p>
            </div>
          </a>
        )}
      </motion.div>

      <style jsx>{`
        .page-wrapper {
          max-width: 600px;
          margin: 0 auto;
          padding: 1.25rem 1.25rem 6rem;
        }
        @media (min-width: 768px) {
          .page-wrapper { padding: 2rem 2rem 4rem; }
        }

        /* Top bar */
        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.25rem;
        }
        .back-btn {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--glass-bg, rgba(255,255,255,0.05));
          border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
          color: var(--text-muted, #94a3b8);
          font-size: 1.125rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .back-btn:hover { background: rgba(255,255,255,0.09); }
        .chat-icon-btn {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.125rem;
          text-decoration: none;
          transition: background 0.2s;
        }
        .chat-icon-btn:hover { background: rgba(16,185,129,0.18); }

        /* Hero */
        .hero {
          display: flex;
          gap: 1.125rem;
          align-items: flex-start;
          margin-bottom: 1.25rem;
        }
        .hero-avatar {
          position: relative;
          width: 100px;
          height: 100px;
          border-radius: 22px;
          overflow: hidden;
          background: linear-gradient(135deg, #4c1d95, #7c3aed);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hero-initials {
          font-size: 2rem;
          font-weight: 700;
          color: white;
        }
        .hero-info { flex: 1; min-width: 0; padding-top: 4px; }
        .hero-name {
          font-size: 1.3125rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text-primary, #f1f5f9);
          margin: 0 0 4px;
        }
        .hero-job {
          font-size: 0.875rem;
          color: var(--text-secondary, #cbd5e1);
          margin: 0 0 2px;
        }
        .hero-company, .hero-country {
          font-size: 0.8rem;
          color: var(--text-muted, #94a3b8);
          margin: 0 0 2px;
        }

        /* Actions */
        .actions-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.625rem;
          margin-bottom: 1.25rem;
        }
        .btn-action {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.625rem 1.125rem;
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .btn-message {
          background: rgba(16,185,129,0.1);
          border-color: rgba(16,185,129,0.22);
          color: #059669;
        }
        .btn-message:hover { background: rgba(16,185,129,0.18); }
        .btn-meeting {
          background: var(--brand-500, #7c3aed);
          color: white;
          border-color: transparent;
        }
        .btn-meeting:hover { background: var(--brand-600, #6d28d9); transform: translateY(-1px); }
        .btn-meeting-pending {
          background: rgba(245,158,11,0.1);
          border-color: rgba(245,158,11,0.22);
          color: #d97706;
        }
        .btn-meeting-confirmed {
          background: rgba(16,185,129,0.1);
          border-color: rgba(16,185,129,0.22);
          color: #059669;
        }
        .btn-linkedin {
          background: rgba(10,102,194,0.1);
          border-color: rgba(10,102,194,0.22);
          color: #0a66c2;
        }
        .btn-linkedin:hover { background: rgba(10,102,194,0.18); }

        /* Section cards */
        .section-card {
          background: var(--glass-bg, rgba(255,255,255,0.04));
          border: 1px solid var(--border-subtle, rgba(255,255,255,0.07));
          border-radius: 18px;
          padding: 1rem 1.125rem;
          margin-bottom: 0.875rem;
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }
        .section-label {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--brand-400, #a78bfa);
          margin: 0;
        }
        .ai-section { background: rgba(124,58,237,0.05); border-color: rgba(139,92,246,0.15); }
        .ai-text {
          font-size: 0.875rem;
          color: var(--text-secondary, #cbd5e1);
          line-height: 1.65;
          margin: 0;
          font-style: italic;
        }
        .bio-text {
          font-size: 0.875rem;
          color: var(--text-secondary, #cbd5e1);
          line-height: 1.65;
          margin: 0;
          white-space: pre-wrap;
        }

        /* Tags */
        .tags-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .tag-chip {
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(124,58,237,0.1);
          border: 1px solid rgba(139,92,246,0.18);
          color: #c4b5fd;
          font-size: 0.75rem;
          font-weight: 500;
        }

        /* Info grid */
        .info-grid { display: flex; flex-direction: column; gap: 0; }

        /* LinkedIn block */
        .linkedin-block {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          background: rgba(10,102,194,0.08);
          border: 1px solid rgba(10,102,194,0.18);
          border-radius: 16px;
          padding: 14px 16px;
          text-decoration: none;
          transition: background 0.2s;
          margin-bottom: 0.875rem;
        }
        .linkedin-block:hover { background: rgba(10,102,194,0.13); }
        .linkedin-logo {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #0a66c2;
          color: white;
          font-size: 1.125rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .linkedin-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-primary, #f1f5f9);
          margin: 0 0 2px;
        }
        .linkedin-sub {
          font-size: 0.78rem;
          color: #0a66c2;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        gap: "1rem",
      }}
    >
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted, #94a3b8)", display: "flex", alignItems: "center", gap: "6px" }}>
        {icon} {label}
      </span>
      <span
        style={{
          fontSize: "0.8rem",
          fontWeight: 500,
          color: accent ? "#a78bfa" : "var(--text-secondary, #cbd5e1)",
          textAlign: "right",
          maxWidth: "60%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Meeting History Item ─────────────────────────────────────────────────────

function MeetingHistoryItem({ meeting }: { meeting: any }) {
  const statusColors: Record<string, string> = {
    CONFIRMED: "#059669",
    PENDING: "#d97706",
    COMPLETED: "#4f46e5",
    CANCELLED: "#dc2626",
    RESCHEDULED: "#7c3aed",
  };
  const color = statusColors[meeting.status] ?? "#94a3b8";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        borderRadius: "12px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        gap: "12px",
      }}
    >
      <div>
        {meeting.slot && (
          <p style={{ margin: "0 0 2px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary, #f1f5f9)" }}>
            {formatDate(meeting.slot.startTime)} · {formatTime(meeting.slot.startTime)}
          </p>
        )}
        {meeting.table && (
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" }}>
            Table {meeting.table.number} · {meeting.table.room}
          </p>
        )}
      </div>
      <span
        style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          color,
          padding: "3px 8px",
          borderRadius: "6px",
          background: `${color}18`,
          flexShrink: 0,
        }}
      >
        {meeting.statusLabel ?? meeting.status}
      </span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div style={{ padding: "1.25rem", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ height: "38px", width: "38px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", marginBottom: "1.25rem", animation: "shimmer 1.5s ease infinite" }} />
      <div style={{ display: "flex", gap: "1.125rem", marginBottom: "1.25rem" }}>
        <div style={{ width: "100px", height: "100px", borderRadius: "22px", background: "rgba(255,255,255,0.06)", flexShrink: 0, animation: "shimmer 1.5s ease infinite" }} />
        <div style={{ flex: 1 }}>
          {[120, 90, 70].map((w, i) => (
            <div key={i} style={{ height: "14px", width: `${w}px`, borderRadius: "6px", background: "rgba(255,255,255,0.06)", marginBottom: "8px", animation: "shimmer 1.5s ease infinite", animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: "80px", borderRadius: "18px", background: "rgba(255,255,255,0.06)", marginBottom: "0.875rem", animation: "shimmer 1.5s ease infinite", animationDelay: `${i * 0.1}s` }} />
      ))}
      <style>{`@keyframes shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }`}</style>
    </div>
  );
}