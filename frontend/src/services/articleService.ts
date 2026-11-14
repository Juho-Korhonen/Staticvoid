import type { AnalysisProgress, AnalyzedArticle, Comparison, PageSearchResult, RevisionPoint } from '../types';

const API_URL = '/api';
const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length;

type AnalysisEvent =
  | ({ type: 'progress' } & AnalysisProgress)
  | { type: 'complete'; result: AnalyzedArticle }
  | { type: 'error'; detail: string };

async function request(path: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(`${API_URL}${path}`, { signal });
  if (!response.ok) {
    // Keep the status message when the server doesn't return a JSON `detail`.
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === 'string' ? body.detail : `API returned ${response.status}`);
  }
  return response;
}

/** Each line of a newline-delimited JSON stream, parsed. */
async function* readNdjson<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = done ? '' : lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as T;
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function toComparison(result: AnalyzedArticle): Comparison {
  const analysis = result.rhetoric_analysis;
  const point = (revision: RevisionPoint | null, url: string | null) =>
    revision && { date: revision.timestamp.slice(0, ISO_DATE_LENGTH), url };
  return {
    from: point(result.baseline, analysis.sources.before),
    to: point(result.final, analysis.sources.after),
    analysis,
    revisionCount: result.summary.revisions,
    editorCount: result.summary.editors,
  };
}

/** Search current and historical article titles. */
export async function searchArticles(query: string, limit: number, signal?: AbortSignal): Promise<PageSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return (await request(`/pages/search?${params}`, signal)).json();
}

/** Review every saved edit, reporting progress until a complete result arrives. */
export async function compareArticle(
  title: string,
  from: string,
  to: string,
  signal?: AbortSignal,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<Comparison> {
  const params = new URLSearchParams({
    title, start: from, end: to,
    max_revisions: '0', // the UI shows only the review, not the raw revision diffs
    analyze: 'true', stream: 'true',
  });
  const response = await request(`/changes?${params}`, signal);
  if (!response.body) throw new Error('The analysis stream is unavailable. No complete review was received.');
  for await (const event of readNdjson<AnalysisEvent>(response.body)) {
    if (event.type === 'error') throw new Error(event.detail);
    if (event.type === 'complete') return toComparison(event.result);
    onProgress?.(event);
  }
  throw new Error('Analysis interrupted before completion. Not all changes were inspected.');
}
