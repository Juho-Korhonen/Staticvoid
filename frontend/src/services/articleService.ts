import type { ArticleChanges, Comparison, PageSearchResult } from '../types';

const API_URL = '/api';

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { signal });
  if (!response.ok) {
    let message = `API returned ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) message = body.detail;
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

/** UI adapter while the existing view is being migrated to the richer API model. */
export async function compareArticle(
  title: string,
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<Comparison> {
  const result = await getArticleChanges(title, from, to, signal);
  const changes = result.revisions.flatMap((revision) => {
    const wording = revision.word_changes.map((change) => ({
      kind: 'modified' as const,
      oldText: change.before,
      newText: change.after,
      toneDelta: 0,
      hedgeAdded: false,
    }));
    const additions = revision.added.map((text) => ({
      kind: 'added' as const,
      oldText: null,
      newText: text,
      toneDelta: 0,
      hedgeAdded: false,
    }));
    const removals = revision.removed.map((text) => ({
      kind: 'removed' as const,
      oldText: text,
      newText: null,
      toneDelta: 0,
      hedgeAdded: false,
    }));
    return [...wording, ...additions, ...removals];
  });

  return {
    article: result.title,
    from: result.baseline ? { date: result.baseline.timestamp.slice(0, 10), revId: result.baseline.rev_id, title: result.baseline.title } : null,
    to: result.final ? { date: result.final.timestamp.slice(0, 10), revId: result.final.rev_id, title: result.final.title } : null,
    changes,
  };
}
