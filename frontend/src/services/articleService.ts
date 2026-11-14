import type { ChangesResponse, PageMatch } from '../types';

// The Python API (mariadb/server). It allows CORS from the Vite dev/preview ports.
// Set VITE_API_URL in frontend/.env to point somewhere else.
const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

/** Number of individual edits to fetch; the summary still counts all of them. */
const MAX_REVISIONS = 50;

async function getJson<T>(path: string, query: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}?${query}`, { signal });
  if (!res.ok) {
    // FastAPI puts the reason in `detail`.
    const body = await res.json().catch(() => null);
    const detail = typeof body?.detail === 'string' ? body.detail : null;
    throw new Error(detail ?? `Backend returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Everything that changed in an article between two dates.
 * `start` and `end` are YYYY-MM-DD; both days are included.
 */
export function getChanges(
  title: string,
  start: string,
  end: string,
  signal?: AbortSignal
): Promise<ChangesResponse> {
  // The API's `end` is exclusive, so ask for up to the start of the next day.
  const qs = new URLSearchParams({
    title,
    start,
    end: nextDay(end),
    max_revisions: String(MAX_REVISIONS),
  });
  return getJson<ChangesResponse>('/changes', qs, signal);
}

/** Articles whose current or any former title contains `q`. */
export function searchPages(q: string, signal?: AbortSignal, limit = 10): Promise<PageMatch[]> {
  return getJson<PageMatch[]>('/pages/search', new URLSearchParams({ q, limit: String(limit) }), signal);
}

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
