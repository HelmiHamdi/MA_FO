// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatDate = (date: string | Date, fmt = "dd MMM yyyy") =>
  format(new Date(date), fmt, { locale: fr });

export const formatTime = (date: string | Date) =>
  format(new Date(date), "HH:mm", { locale: fr });

export const timeAgo = (date: string | Date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });

export const formatCountdown = (ms: number): string => {
  if (ms <= 0) return "Maintenant";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export const getInitials = (firstName?: string, lastName?: string) => {
  if (!firstName && !lastName) return "??";
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
};

/**
 * Résout une URL de photo de profil :
 * - URL Cloudinary / absolue  → retournée telle quelle
 * - URL relative /uploads/... → préfixée avec BACKEND_URL (ancienne donnée en DB)
 * - null / undefined          → avatar par défaut
 */
export const resolvePhotoUrl = (photoUrl?: string | null): string => {
  if (!photoUrl) return "/default-avatar.png";

  // URL absolue (Cloudinary https://res.cloudinary.com/... ou autre)
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
    return photoUrl;
  }

  // URL relative /uploads/filename.png (ancienne donnée en DB avant Cloudinary)
  const backendBase =
    process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ??
    "http://localhost:5000";
  return `${backendBase}${photoUrl}`;
};

export const profileTypeColors: Record<string, string> = {
  INSTITUTIONNEL: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  VIP:            "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  OPERATEUR:      "bg-green-500/20 text-green-300 border-green-500/30",
  MEDIA:          "bg-pink-500/20 text-pink-300 border-pink-500/30",
  STANDARD:       "bg-white/10 text-white/60 border-white/20",
};

export const meetingStatusColors: Record<string, string> = {
  PENDING:     "bg-amber-500/20 text-amber-300",
  CONFIRMED:   "bg-emerald-500/20 text-emerald-300",
  CANCELLED:   "bg-red-500/20 text-red-300",
  COMPLETED:   "bg-blue-500/20 text-blue-300",
  RESCHEDULED: "bg-purple-500/20 text-purple-300",
};

export const notificationIcons: Record<string, string> = {
  NEW_SWIPE_BATCH:               "🎯",
  MUTUAL_MATCH:                  "💜",
  CONNECTION_REQUEST_RECEIVED:   "🤝",
  CONNECTION_REQUEST_ACCEPTED:   "✅",
  MEETING_REQUEST_RECEIVED:      "📅",
  MEETING_CONFIRMED:             "✅",
  MEETING_REFUSED:               "❌",
  MEETING_REMINDER:              "⏰",
  NEW_MESSAGE:                   "💬",
  MEETING_CANCELLED:             "🚫",
  MEETING_RESCHEDULED:           "🔄",
  POST_MEETING_RATING:           "⭐",
  BEHAVIORAL_NUDGE:              "💡",
  PROFILE_VECTORIZED:            "🤖",
  ACCOUNT_ACTIVATED:             "🎉",
};

export const parseTags = (tags?: string): string[] => {
  if (!tags) return [];
  try { return JSON.parse(tags); }
  catch { return tags.split(",").map((t) => t.trim()).filter(Boolean); }
};