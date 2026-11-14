import { useEffect, useRef, useState } from 'react';
import { compareArticle } from '../services/articleService';
import type { AnalysisProgress, Comparison } from '../types';

interface State {
  data: Comparison | null;
  loading: boolean;
  error: string | null;
  progress: AnalysisProgress | null;
}

/** Loads the comparison whenever the article or either date changes. */
export function useComparison(title: string, from: string, to: string, requestId = 0): State & { cancel: () => void } {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null, progress: null });
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!from || !to || from >= to) {
      setState({ data: null, loading: false, error: null, progress: null });
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;

    setState({ data: null, loading: true, error: null, progress: { stage: 'loading' } });
    // Debounce date edits and React StrictMode's replay before making paid requests.
    const timer = window.setTimeout(() => {
      compareArticle(title, from, to, controller.signal, (progress) => {
        if (!controller.signal.aborted) setState((prev) => ({ ...prev, progress }));
      })
        .then((data) => {
          if (!controller.signal.aborted) setState((prev) => ({ ...prev, data, loading: false, error: null }));
        })
        .catch((err: Error) => {
          if (controller.signal.aborted) return; // a newer request replaced this one
          setState((prev) => ({ ...prev, data: null, loading: false, error: err.message }));
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [title, from, to, requestId]);

  function cancel() {
    activeRequest.current?.abort();
    setState((prev) => ({ ...prev, data: null, loading: false, error: 'Analysis cancelled before completion.' }));
  }

  return { ...state, cancel };
}
