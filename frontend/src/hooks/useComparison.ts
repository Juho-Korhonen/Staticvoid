import { useEffect, useRef, useState } from 'react';
import { compareArticle } from '../services/articleService';
import type { AnalysisProgress, Comparison } from '../types';

// Debounces date edits and React StrictMode's replay before making paid requests.
const DEBOUNCE_MS = 400;

interface State {
  data: Comparison | null;
  loading: boolean;
  error: string | null;
  progress: AnalysisProgress | null;
}

const IDLE: State = { data: null, loading: false, error: null, progress: null };

/** Loads the comparison whenever the article, either date or `requestId` changes. */
export function useComparison(title: string, from: string, to: string, requestId = 0): State & { cancel: () => void } {
  const [state, setState] = useState<State>({ ...IDLE, loading: true });
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!from || !to || from >= to) {
      setState(IDLE);
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    const isCurrent = () => !controller.signal.aborted; // a newer request replaces this one

    setState({ ...IDLE, loading: true, progress: { stage: 'loading' } });
    const timer = window.setTimeout(() => {
      compareArticle(title, from, to, controller.signal, (progress) => {
        if (isCurrent()) setState((prev) => ({ ...prev, progress }));
      })
        .then((data) => {
          if (isCurrent()) setState((prev) => ({ ...prev, data, loading: false, error: null }));
        })
        .catch((err: Error) => {
          if (isCurrent()) setState((prev) => ({ ...prev, data: null, loading: false, error: err.message }));
        });
    }, DEBOUNCE_MS);

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
