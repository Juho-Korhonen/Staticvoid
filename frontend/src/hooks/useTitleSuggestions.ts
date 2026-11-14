import { useEffect, useState } from 'react';
import { searchArticles } from '../services/articleService';
import type { PageSearchResult } from '../types';

const MIN_QUERY_LENGTH = 2;
const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 250;

/** Article titles matching `query`, unless it is already the selected article. */
export function useTitleSuggestions(query: string, selectedTitle: string) {
  const [suggestions, setSuggestions] = useState<PageSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const trimmed = query.trim();
  const active = trimmed.length >= MIN_QUERY_LENGTH
    && trimmed.toLocaleLowerCase() !== selectedTitle.toLocaleLowerCase();

  useEffect(() => {
    if (!active) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchArticles(trimmed, SUGGESTION_LIMIT, controller.signal)
        .then(setSuggestions)
        .catch((err: Error) => {
          if (err.name !== 'AbortError') setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, active]);

  return active ? { suggestions, loading } : { suggestions: [], loading: false };
}
