"use client";
// src/app/(app)/connections/page.tsx
// Module 4.1 — Connections List

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { connectionsApi } from "@/lib/api";
import { ConnectionListItem } from "@/types";
import { getInitials, getFullName, timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = "activity" | "name" | "meeting";
type FilterKey = "all" | "with_meeting" | "without_meeting" | "unread";

const CONNECTION_TYPE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  MATCHED: {
    label: "Match mutuel",
    bg: "rgba(168,85,247,0.12)",
    text: "#a855f7",
  },
  CONNECTED: {
    label: "Connecté",
    bg: "rgba(16,185,129,0.12)",
    text: "#059669",
  },
};

const MEETING_STATUS_CONFIG: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  NONE: { label: "Pas de réunion", icon: "—", color: "var(--text-ghost, #475569)" },
  PENDING: { label: "Réunion en attente", icon: "⏳", color: "#d97706" },
  CONFIRMED: { label: "Réunion confirmée", icon: "✅", color: "#059669" },
  COMPLETED: { label: "Réunion terminée", icon: "☑️", color: "#4f46e5" },
  CANCELLED: { label: "Réunion annulée", icon: "✕", color: "#dc2626" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("activity");
  const [filter, setFilter] = useState<FilterKey>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => connectionsApi.getAll().then((r) => r.data),
    staleTime: 30_000,
  });

  const connections: ConnectionListItem[] = data?.data ?? [];

  // ── Filter + Search + Sort ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...connections];

    // Filter
    if (filter === "with_meeting") {
      result = result.filter((c) => c.meetingStatus !== "NONE");
    } else if (filter === "without_meeting") {
      result = result.filter((c) => c.meetingStatus === "NONE");
    } else if (filter === "unread") {
      result = result.filter((c) => c.unreadCount > 0);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          getFullName(
            c.otherParticipant?.firstName,
            c.otherParticipant?.lastName,
          )
            .toLowerCase()
            .includes(q) ||
          (c.otherParticipant?.company ?? "").toLowerCase().includes(q),
      );
    }

    // Sort
    if (sort === "activity") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sort === "name") {
      result.sort((a, b) =>
        getFullName(
          a.otherParticipant?.firstName,
          a.otherParticipant?.lastName,
        ).localeCompare(
          getFullName(
            b.otherParticipant?.firstName,
            b.otherParticipant?.lastName,
          ),
        ),
      );
    } else if (sort === "meeting") {
      const order = ["CONFIRMED", "PENDING", "COMPLETED", "NONE", "CANCELLED"];
      result.sort(
        (a, b) =>
          order.indexOf(a.meetingStatus) - order.indexOf(b.meetingStatus),
      );
    }

    return result;
  }, [connections, filter, search, sort]);

  if (isLoading) return <ConnectionsSkeleton />;

  return (
    <div className="page-wrapper">
      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="page-header"
      >
        <div>
          <h1 className="page-title">Mes Connexions</h1>
          <p className="page-subtitle">
            {connections.length > 0
              ? `${connections.length} connexion${connections.length > 1 ? "s" : ""}`
              : "Aucune connexion"}
          </p>
        </div>
        <Link href="/discovery" className="btn-discover">
          <span>+</span>
          <span className="btn-label">Découvrir</span>
        </Link>
      </motion.header>

      {/* ── Search ── */}
      <div className="search-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou entreprise…"
          className="search-input"
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch("")}>
            ✕
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="filters-row">
        {(
          [
            { key: "all", label: "Toutes" },
            { key: "with_meeting", label: "Avec réunion" },
            { key: "without_meeting", label: "Sans réunion" },
            { key: "unread", label: "Non lus" },
          ] as { key: FilterKey; label: string }[]
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`filter-chip ${filter === f.key ? "active" : ""}`}
          >
            {f.label}
            {f.key === "unread" &&
              connections.filter((c) => c.unreadCount > 0).length > 0 && (
                <span className="unread-badge">
                  {connections.filter((c) => c.unreadCount > 0).length}
                </span>
              )}
          </button>
        ))}

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="sort-select"
        >
          <option value="activity">Récent</option>
          <option value="name">Nom</option>
          <option value="meeting">Réunion</option>
        </select>
      </div>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <EmptyState hasConnections={connections.length > 0} search={search} />
      ) : (
        <div className="connections-list">
          <AnimatePresence>
            {filtered.map((item, i) => (
              <ConnectionCard key={item.id} item={item} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <style jsx>{`
        .page-wrapper {
          max-width: 680px;
          margin: 0 auto;
          padding: 3.5rem 1.25rem 6rem;
        }
        @media (min-width: 768px) {
          .page-wrapper {
            padding: 2rem 2rem 4rem;
          }
        }

        /* Header */
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          gap: 1rem;
        }
        .page-title {
          font-family: var(--font-display, "Georgia", serif);
          font-size: clamp(1.5rem, 4vw, 1.875rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          color: var(--text-primary, #f1f5f9);
          margin: 0;
        }
        .page-subtitle {
          font-size: 0.8125rem;
          color: var(--text-muted, #94a3b8);
          margin-top: 3px;
        }
        .btn-discover {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: var(--brand-500, #7c3aed);
          color: white;
          border-radius: 10px;
          padding: 0.5rem 0.875rem;
          font-size: 0.8125rem;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.2s, transform 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .btn-discover:hover {
          background: var(--brand-600, #6d28d9);
          transform: translateY(-1px);
        }
        .btn-label {
          display: none;
        }
        @media (min-width: 480px) {
          .btn-label { display: inline; }
        }

        /* Search */
        .search-wrapper {
          position: relative;
          margin-bottom: 0.875rem;
        }
        .search-icon {
          position: absolute;
          left: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.875rem;
          pointer-events: none;
        }
        .search-input {
          width: 100%;
          height: 44px;
          background: var(--glass-bg, rgba(255,255,255,0.04));
          border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
          border-radius: 12px;
          padding: 0 2.5rem 0 2.5rem;
          color: var(--text-primary, #f1f5f9);
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .search-input:focus {
          border-color: var(--brand-400, #a78bfa);
        }
        .search-input::placeholder {
          color: var(--text-ghost, #475569);
        }
        .search-clear {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-ghost, #475569);
          cursor: pointer;
          font-size: 0.75rem;
          padding: 4px;
        }

        /* Filters */
        .filters-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: var(--text-muted, #94a3b8);
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .filter-chip:hover {
          background: rgba(255,255,255,0.07);
          color: var(--text-primary, #f1f5f9);
        }
        .filter-chip.active {
          background: rgba(124,58,237,0.15);
          border-color: rgba(139,92,246,0.4);
          color: #c4b5fd;
        }
        .unread-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 8px;
          background: #ef4444;
          color: white;
          font-size: 0.625rem;
          font-weight: 700;
        }
        .sort-select {
          margin-left: auto;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          color: var(--text-muted, #94a3b8);
          font-size: 0.75rem;
          padding: 5px 8px;
          cursor: pointer;
          outline: none;
        }

        /* List */
        .connections-list {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }
      `}</style>
    </div>
  );
}

// ─── Connection Card ───────────────────────────────────────────────────────────

function ConnectionCard({
  item,
  index,
}: {
  item: ConnectionListItem;
  index: number;
}) {
  const typeConf = CONNECTION_TYPE_LABELS[item.type] ?? CONNECTION_TYPE_LABELS.CONNECTED;
  const meetingConf =
    MEETING_STATUS_CONFIG[item.meetingStatus] ?? MEETING_STATUS_CONFIG.NONE;
  const hasMeeting = item.meetingStatus !== "NONE";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 260, damping: 22 }}
    >
      <Link href={`/connections/${item.id}`} className="card-link">
        <div className="card">
          {/* Avatar */}
          <div className="avatar">
            {item.otherParticipant?.photoUrl ? (
              <Image
                src={item.otherParticipant.photoUrl}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <span>
                {getInitials(
                  item.otherParticipant?.firstName,
                  item.otherParticipant?.lastName,
                )}
              </span>
            )}
          </div>

          {/* Main content */}
          <div className="card-body">
            <div className="card-top">
              <div className="name-row">
                <p className="name">
                  {getFullName(
                    item.otherParticipant?.firstName,
                    item.otherParticipant?.lastName,
                  )}
                </p>
                <span
                  className="type-badge"
                  style={{ background: typeConf.bg, color: typeConf.text }}
                >
                  {typeConf.label}
                </span>
              </div>
              <p className="job">
                {item.otherParticipant?.jobTitle}
                {item.otherParticipant?.company
                  ? ` · ${item.otherParticipant.company}`
                  : ""}
              </p>
            </div>

            {/* Last message preview */}
            {item.lastMessage ? (
              <p className="last-message">
                {item.lastMessage.content.length > 60
                  ? `${item.lastMessage.content.slice(0, 60)}…`
                  : item.lastMessage.content}
              </p>
            ) : (
              <p className="last-message empty">Pas encore de messages</p>
            )}

            {/* Footer row */}
            <div className="card-footer">
              <span
                className="meeting-status"
                style={{ color: meetingConf.color }}
              >
                {meetingConf.icon} {meetingConf.label}
              </span>
              <div className="meta-right">
                {item.lastMessage && (
                  <span className="time-ago">
                    {timeAgo(item.lastMessage.createdAt)}
                  </span>
                )}
                {item.unreadCount > 0 && (
                  <span className="unread-pill">{item.unreadCount}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>

      <style jsx>{`
        .card-link { text-decoration: none; display: block; }
        .card {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          background: var(--glass-bg, rgba(255,255,255,0.04));
          border: 1px solid var(--border-subtle, rgba(255,255,255,0.07));
          border-radius: 18px;
          padding: 14px 16px;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .card:hover {
          border-color: rgba(139,92,246,0.25);
          background: rgba(255,255,255,0.06);
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }

        /* Avatar */
        .avatar {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          overflow: hidden;
          background: linear-gradient(135deg, #4c1d95, #7c3aed);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: white;
          font-size: 0.9375rem;
        }

        /* Body */
        .card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .card-top { display: flex; flex-direction: column; gap: 2px; }
        .name-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .name {
          font-weight: 700;
          font-size: 0.9375rem;
          color: var(--text-primary, #f1f5f9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }
        .type-badge {
          flex-shrink: 0;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          white-space: nowrap;
        }
        .job {
          font-size: 0.78rem;
          color: var(--text-muted, #94a3b8);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Last message */
        .last-message {
          font-size: 0.8rem;
          color: var(--text-secondary, #cbd5e1);
          line-height: 1.4;
          margin: 2px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .last-message.empty { color: var(--text-ghost, #475569); font-style: italic; }

        /* Footer */
        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 2px;
        }
        .meeting-status {
          font-size: 0.72rem;
          font-weight: 600;
        }
        .meta-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .time-ago {
          font-size: 0.7rem;
          color: var(--text-ghost, #475569);
        }
        .unread-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9px;
          background: var(--brand-500, #7c3aed);
          color: white;
          font-size: 0.65rem;
          font-weight: 700;
        }
      `}</style>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  hasConnections,
  search,
}: {
  hasConnections: boolean;
  search: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "4rem 1rem 2rem",
        gap: "0.5rem",
      }}
    >
      <span style={{ fontSize: "3rem", display: "block", marginBottom: "0.5rem" }}>
        {search ? "🔍" : "🤝"}
      </span>
      <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-secondary, #cbd5e1)", margin: 0 }}>
        {search
          ? "Aucun résultat trouvé"
          : hasConnections
          ? "Aucune connexion avec ce filtre"
          : "Aucune connexion pour l'instant"}
      </p>
      <p style={{ fontSize: "0.875rem", color: "var(--text-muted, #94a3b8)", maxWidth: "280px", lineHeight: 1.5, margin: 0 }}>
        {search
          ? `Aucune connexion ne correspond à "${search}"`
          : "Commencez à swiper ou parcourez les profils pour vous connecter"}
      </p>
      {!hasConnections && (
        <Link
          href="/discovery"
          style={{
            marginTop: "1rem",
            padding: "0.625rem 1.5rem",
            borderRadius: "10px",
            background: "var(--brand-500, #7c3aed)",
            color: "white",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Découvrir des profils
        </Link>
      )}
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ConnectionsSkeleton() {
  return (
    <div style={{ padding: "3.5rem 1.25rem 1.5rem", maxWidth: "680px", margin: "0 auto" }}>
      <div style={{ height: "2rem", width: "12rem", borderRadius: "8px", background: "rgba(255,255,255,0.06)", marginBottom: "1.5rem", animation: "shimmer 1.5s ease infinite" }} />
      <div style={{ height: "44px", borderRadius: "12px", background: "rgba(255,255,255,0.06)", marginBottom: "0.875rem", animation: "shimmer 1.5s ease infinite" }} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ height: "88px", borderRadius: "18px", background: "rgba(255,255,255,0.06)", marginBottom: "0.625rem", animation: "shimmer 1.5s ease infinite", animationDelay: `${i * 0.08}s` }} />
      ))}
      <style>{`@keyframes shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }`}</style>
    </div>
  );
}