// ws/stats/live/ (guds backend, docs/STATISTICS_API.md §8): online workers
// and in-flight jobs, pushed by the server whenever they change.

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, getToken } from "./api";

export type WorkerState = "online_idle" | "offer_pending" | "on_job";
export type ActiveJobStatus = "pending" | "offered" | "accepted" | "en_route" | "arrived" | "in_progress";

export interface Person {
  id: number;
  name: string | null;
  phone: string | null;
}

export interface LiveWorker extends Person {
  state: WorkerState;
  online_since: string | null;
  categories: string[];
  rating: number | null;
  total_jobs: number;
  is_verified: boolean;
  lat: number | null;
  lng: number | null;
  current_job_id: string | null;
}

export interface LiveJob {
  job_id: string;
  status: ActiveJobStatus;
  category: string;
  client: Person | null;
  worker: Person | null;
  price: number | null;
  currency: string;
  workers_count: number;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
}

export interface LiveSnapshot {
  generated_at: string;
  counts: {
    workers: { total: number } & Record<WorkerState, number>;
    jobs: { total: number } & Record<ActiveJobStatus, number>;
    registered_workers: number;
    verified_workers: number;
  };
  today: {
    date: string;
    created: number;
    completed: number;
    cancelled: number;
    expired: number;
    revenue: number;
    commission: number;
    by_category: { category: string; jobs: number }[];
    by_hour: { hour: number; created: number; completed: number }[];
  };
  workers: LiveWorker[];
  jobs: LiveJob[];
  limits: { workers: number; jobs: number };
}

/** One point of the trend drawn from the snapshots received while the page is open. */
export interface LivePoint {
  at: number;
  workers: number;
  jobs: number;
}

export type LiveStatus = "connecting" | "open" | "reconnecting" | "unauthorized" | "forbidden";

export const LIVE_PATH = "/ws/stats/live/";
const HISTORY_LIMIT = 360; // ~30 min at one point per 5 s
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 15_000];
const PING_MS = 25_000;

export function liveUrl(token: string): string {
  const url = new URL(LIVE_PATH, API_BASE);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.toString();
}

export function useLiveStats() {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [data, setData] = useState<LiveSnapshot | null>(null);
  const [history, setHistory] = useState<LivePoint[]>([]);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      const token = getToken();
      if (!token) {
        setStatus("unauthorized");
        return;
      }
      const socket = new WebSocket(liveUrl(token));
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
        setStatus("open");
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
        }, PING_MS);
      };
      socket.onmessage = (event) => {
        let message: { type?: string; data?: LiveSnapshot };
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type !== "snapshot" || !message.data) return;
        const snapshot = message.data;
        const now = Date.now();
        setData(snapshot);
        setReceivedAt(now);
        setHistory((prev) =>
          [...prev, { at: now, workers: snapshot.counts.workers.total, jobs: snapshot.counts.jobs.total }].slice(
            -HISTORY_LIMIT,
          ),
        );
      };
      socket.onclose = (event) => {
        clearInterval(pingTimer);
        if (disposed) return;
        // 4001: no or expired token, 4003: no statistics permission. Retrying cannot help.
        if (event.code === 4001) return setStatus("unauthorized");
        if (event.code === 4003) return setStatus("forbidden");
        setStatus("reconnecting");
        retryTimer = setTimeout(connect, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      socketRef.current?.close();
    };
  }, []);

  const refresh = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "refresh" }));
  }, []);

  return { status, data, history, receivedAt, refresh };
}

/** Re-renders every `ms` so "online for 12 min" style durations keep moving. */
export function useNow(ms = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
