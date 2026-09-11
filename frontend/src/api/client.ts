import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "clinicflow_token";

// Web fallback (SecureStore not supported on web)
const webStore = {
  async getItemAsync(k: string) {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(k);
  },
  async setItemAsync(k: string, v: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(k, v);
  },
  async deleteItemAsync(k: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(k);
  },
};

const store = Platform.OS === "web" ? webStore : SecureStore;

export async function getToken(): Promise<string | null> {
  return store.getItemAsync(TOKEN_KEY);
}

export async function setToken(t: string) {
  await store.setItemAsync(TOKEN_KEY, t);
}

export async function clearToken() {
  await store.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, name: string, password: string) =>
    request<{ token: string; user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, name, password }),
    }),
  me: () => request<any>("/auth/me"),
  metrics: () => request<any>("/dashboard/metrics"),
  analytics: () => request<any>("/analytics/weekly"),
  bookings: (params: { status?: string; search?: string; start?: string; end?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status_filter", params.status);
    if (params.search) q.set("search", params.search);
    if (params.start) q.set("start_date", params.start);
    if (params.end) q.set("end_date", params.end);
    const qs = q.toString();
    return request<{ bookings: any[]; count: number }>(`/bookings${qs ? `?${qs}` : ""}`);
  },
  createBooking: (data: {
    name: string; phone: string; date: string; time: string;
    service_type?: string; price?: number; notes?: string;
  }) =>
    request<any>("/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStatus: (id: string, status: string) =>
    request<any>(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  patchBooking: (id: string, data: { notes?: string; price?: number; paid?: boolean; service_type?: string }) =>
    request<any>(`/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  reschedule: (id: string, new_date: string, new_time: string) =>
    request<any>(`/bookings/${id}/reschedule`, {
      method: "POST",
      body: JSON.stringify({ new_date, new_time }),
    }),
  sync: () => request<any>("/bookings/sync", { method: "POST" }),
  noShows: () => request<{ bookings: any[]; count: number }>("/bookings/no-shows"),
  sendReminder: (id: string) => request<any>(`/bookings/${id}/send-reminder`, { method: "POST" }),
  clients: () => request<{ clients: any[]; count: number }>("/clients"),
  client: (key: string) => request<any>(`/clients/${encodeURIComponent(key)}`),
  services: () => request<{ services: any[] }>("/analytics/services"),
  getWebhooks: () => request<any>("/settings/webhooks"),
  updateWebhooks: (data: any) =>
    request<any>("/settings/webhooks", { method: "PUT", body: JSON.stringify(data) }),
};

export const backendUrl = BASE;
