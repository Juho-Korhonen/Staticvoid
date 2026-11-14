import type { Analysis, AnalysisProgress, ArticleChanges, Comparison, PageSearchResult } from '../types';

const API_URL = '/api';

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { signal });
  if (!response.ok) {
    let message = `API returned ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') message = body.detail;
    } catch {
      // Keep the status message when the server doesn't return JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

/** Search current and historical article titles. */
export function searchArticles(
  query: string,
  limit = 20,
  signal?: AbortSignal
): Promise<PageSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return fetchJson(`/pages/search?${params}`, signal);
}

/** Fetch the API's full revision-by-revision comparison payload. */
export function getArticleChanges(
  title: string,
  start: string,
  end: string,
  signal?: AbortSignal
): Promise<ArticleChanges> {
  const params = new URLSearchParams({ title, start, end });
  return fetchJson(`/changes?${params}`, signal);
}

type AnalyzedArticle = ArticleChanges & { rhetoric_analysis: Analysis };
type AnalysisEvent =
  | ({ type: 'progress' } & AnalysisProgress)
  | { type: 'complete'; result: AnalyzedArticle }
  | { type: 'error'; detail: string };

/** Review every saved edit, reporting progress until a complete result arrives. */
export async function compareArticle(
  title: string,
  from: string,
  to: string,
  signal?: AbortSignal,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<Comparison> {
  const params = new URLSearchParams({ title, start: from, end: to, max_revisions: '0', analyze: 'true', stream: 'true' });
  const response = await fetch(`${API_URL}/changes?${params}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === 'string' ? body.detail : `API returned ${response.status}`);
  }
  if (!response.body) throw new Error('The analysis stream is unavailable. No complete review was received.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: AnalyzedArticle | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AnalysisEvent;
    if (event.type === 'error') throw new Error(event.detail);
    if (event.type === 'progress') onProgress?.(event);
    if (event.type === 'complete') result = event.result;
  };
  try {
    while (!result) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) consume(line);
      if (done) {
        consume(buffer);
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!result) throw new Error('Analysis interrupted before completion. Not all changes were inspected.');

  return {
    article: result.title,
    from: result.baseline ? { date: result.baseline.timestamp.slice(0, 10), revId: result.baseline.rev_id, title: result.baseline.title } : null,
    to: result.final ? { date: result.final.timestamp.slice(0, 10), revId: result.final.rev_id, title: result.final.title } : null,
    changes: result.rhetoric_analysis.changes,
    analysis: result.rhetoric_analysis,
    revisionCount: result.summary.revisions,
    editorCount: result.summary.editors,
  };
}
