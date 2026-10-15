import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiGet } from "./api";
import type { ApiParams } from "./filters";
import type { Overview } from "./types";

export const OVERVIEW_PATH = "/api/stats/overview/";

// One request per parameter set: concurrent callers share the in-flight
// promise, and a result is reused for a short while, so going back and forth
// in history or re-rendering never repeats a request. The API caches too
// (5 min for ranges including today), so this adds no staleness beyond it.
// Part of a response depends on the viewer (admin_url): clear on logout.
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; data: Overview }>();
const inflight = new Map<string, Promise<Overview>>();

export function overviewKey(params: ApiParams): string {
  return new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
}

export function clearOverviewCache(): void {
  cache.clear();
  inflight.clear();
}

function load(params: ApiParams): Promise<Overview> {
  const key = overviewKey(params);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);
  let promise = inflight.get(key);
  if (!promise) {
    // Not tied to one component's lifetime: a shared request must survive one subscriber leaving.
    promise = apiGet(OVERVIEW_PATH, params)
      .then((response) => response.json())
      .then((body: { data: Overview }) => {
        cache.set(key, { at: Date.now(), data: body.data });
        return body.data;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
  }
  return promise;
}

export type OverviewState =
  | { status: "loading"; data: Overview | null }
  | { status: "success"; data: Overview }
  | { status: "error"; error: ApiError | Error; data: Overview | null };

export function useOverview(params: ApiParams): OverviewState & { retry: () => void } {
  const key = overviewKey(params);
  const [state, setState] = useState<OverviewState>({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    let active = true;
    // Keep the previous data on screen while the next filters load (no layout jump).
    setState((prev) => ({ status: "loading", data: prev.data }));
    load(paramsRef.current).then(
      (data) => active && setState({ status: "success", data }),
      (error: Error) => active && setState((prev) => ({ status: "error", error, data: prev.data })),
    );
    return () => {
      active = false;
    };
  }, [key, attempt]);

  const retry = useCallback(() => {
    cache.delete(key);
    setAttempt((n) => n + 1);
  }, [key]);

  return { ...state, retry };
}
