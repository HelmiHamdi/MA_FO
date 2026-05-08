// src/lib/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";
import { silentPost } from "./silentFetch";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// ─── Request interceptor: attach access token ─────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = Cookies.get("accessToken");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: auto-refresh on 401 ────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (v: string) => void;
  reject: (e: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token!),
  );
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const status = error.response?.status;

    // Routes publiques auth gérées par silentPost — pas de refresh à tenter
    const isPublicAuthRoute =
      originalRequest?.url?.includes("/auth/otp/") ||
      originalRequest?.url?.includes("/auth/qr/") ||
      originalRequest?.url?.includes("/auth/token/refresh");

    if (status === 401 && !originalRequest._retry && !isPublicAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(Promise.reject);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = Cookies.get("refreshToken");
      if (!refreshToken) {
        clearAuth();
        if (typeof window !== "undefined") window.location.href = "/auth";
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/token/refresh`, {
          refreshToken,
        });
        const { accessToken, refreshToken: newRefresh } = data;
        setTokens(accessToken, newRefresh);
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        clearAuth();
        if (typeof window !== "undefined") window.location.href = "/auth";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // Erreurs 500+ → logguer pour le debug, 4xx → silencieux
    if (status && status >= 500) {
      console.error(`[API Error ${status}]`, error.response?.data);
    }

    return Promise.reject(error);
  },
);

// ─── Token helpers ─────────────────────────────────────────────────────────────
export const setTokens = (accessToken: string, refreshToken: string) => {
  Cookies.set("accessToken", accessToken, {
    expires: 1 / 96, // 15min
    secure: true,
    sameSite: "Strict",
  });
  Cookies.set("refreshToken", refreshToken, {
    expires: 7,
    secure: true,
    sameSite: "Strict",
  });
};

export const clearAuth = () => {
  Cookies.remove("accessToken");
  Cookies.remove("refreshToken");
};

// ─── Auth API ──────────────────────────────────────────────────────────────────
// Routes publiques → silentPost (fetch natif, zéro log console)
// Routes protégées → axios
export const authApi = {
  requestEmailOtp: (email: string) =>
    silentPost("/auth/otp/email/request", { email }),
  requestPhoneOtp: (phone: string) =>
    silentPost("/auth/otp/phone/request", { phone }),
  verifyOtp: (payload: { email?: string; phone?: string; code: string }) =>
    silentPost("/auth/otp/verify", payload),
  loginWithQr: (qrToken: string) =>
    silentPost("/auth/qr/login", { qrToken }),
  refreshToken: (refreshToken: string) =>
    api.post("/auth/token/refresh", { refreshToken }),
  logout: (refreshToken?: string) =>
    api.post("/auth/logout", { refreshToken }),
};

// ─── Discovery API ─────────────────────────────────────────────────────────────
export const discoveryApi = {
  getCurrentBatch: () => api.get("/discovery/swipe/batch"),
  recordSwipe: (payload: {
    targetParticipantId: string;
    action: string;
    batchId: string;
  }) => api.post("/discovery/swipe", payload),
  viewAll: (params: Record<string, string | number>) =>
    api.get("/discovery/all", { params }),
  getProfile: (id: string) => api.get(`/discovery/profile/${id}`),
  sendConnectionRequest: (targetParticipantId: string) =>
    api.post("/discovery/connections/request", { targetParticipantId }),
  respondToConnection: (
    connectionId: string,
    action: "ACCEPTED" | "REJECTED",
  ) =>
    api.patch(`/discovery/connections/${connectionId}/respond`, { action }),
};

// ─── Meetings API ──────────────────────────────────────────────────────────────
export const meetingsApi = {
  getAvailableSlots: (receiverId: string) =>
    api.get("/meetings/slots/available", { params: { receiverId } }),
  requestMeeting: (payload: {
    receiverId: string;
    slotId: string;
    message?: string;
  }) => api.post("/meetings/request", payload),
  respondToMeeting: (
    meetingId: string,
    action: "CONFIRMED" | "CANCELLED",
    reason?: string,
  ) => api.patch(`/meetings/${meetingId}/respond`, { action, reason }),
  getMyAgenda: () => api.get("/meetings/agenda"),
  cancelMeeting: (meetingId: string) =>
    api.patch(`/meetings/${meetingId}/cancel`),
  rescheduleMeeting: (meetingId: string, newSlotId: string) =>
    api.patch(`/meetings/${meetingId}/reschedule`, { newSlotId }),
  rateMeeting: (meetingId: string, stars: number, comment?: string) =>
    api.post(`/meetings/${meetingId}/rate`, { stars, comment }),
  confirmTableQr: (meetingId: string, qrToken: string) =>
    api.post("/meetings/confirm-table-qr", { meetingId, qrToken }),
  generateMessage: (receiverId: string) =>
    api.get(`/meetings/generate-message/${receiverId}`),
};

// ─── Profile API ───────────────────────────────────────────────────────────────
export const profileApi = {
  getMe: () => api.get("/profile/me"),
  updateProfile: (payload: {
    bio?: string;
    jobTitle?: string;
    company?: string;
    country?: string;
    tags?: string;
    photoUrl?: string;
  }) => api.patch("/profile/me", payload),
  uploadPhoto: (formData: FormData) =>
    api.post("/profile/me/photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ─── Notifications API ─────────────────────────────────────────────────────────
export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number; type?: string }) =>
    api.get("/notifications", { params }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAllRead: () => api.patch("/notifications/read-all"),
  markOneRead: (notificationId: string) =>
    api.patch(`/notifications/${notificationId}/read`),
  registerPush: (subscription: object) =>
    api.post("/notifications/push/subscribe", { subscription }),
};