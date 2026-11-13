import type { Comparison } from '../types';

const API_URL = '/api';

/** Asks the backend how an article changed between two dates. */
export async function compareArticle(
  title: string,
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<Comparison> {
  const query = new URLSearchParams({ from, to });
  const response = await fetch(
    `${API_URL}/articles/${encodeURIComponent(title)}/compare?${query}`,
    { signal }
  );

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }
  return response.json() as Promise<Comparison>;
}
