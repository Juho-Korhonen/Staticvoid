import { useEffect, useState } from 'react';
import { getChanges } from '../services/articleService';
import type { ChangesResponse } from '../types';

interface State {
  data: ChangesResponse | null;
  loading: boolean;
  error: string | null;
}

/** Loads the changes whenever the article or either date changes. */
export function useChanges(title: string, from: string, to: string): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!title || !from || !to) return;

    // The user may pick the dates in the wrong order, so sort them.
    const [start, end] = from <= to ? [from, to] : [to, from];
    const controller = new AbortController();

    setState((prev) => ({ ...prev, loading: true, error: null }));
    getChanges(title, start, end, controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: Error) => {
        if (err.name === 'AbortError') return; // a newer request replaced this one
        setState({ data: null, loading: false, error: err.message });
      });

    return () => controller.abort();
  }, [title, from, to]);

  return state;
}
