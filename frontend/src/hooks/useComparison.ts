import { useEffect, useState } from 'react';
import { compareArticle } from '../services/articleService';
import type { Comparison } from '../types';

interface State {
  data: Comparison | null;
  loading: boolean;
  error: string | null;
}

/** Loads the comparison whenever the article or either date changes. */
export function useComparison(title: string, from: string, to: string): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!from || !to || from >= to) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();

    setState((prev) => ({ ...prev, loading: true, error: null }));
    // Debounce date edits and React StrictMode's replay before making paid requests.
    const timer = window.setTimeout(() => {
      compareArticle(title, from, to, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setState({ data, loading: false, error: null });
        })
        .catch((err: Error) => {
          if (controller.signal.aborted) return; // a newer request replaced this one
          setState({ data: null, loading: false, error: err.message });
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [title, from, to]);

  return state;
}
