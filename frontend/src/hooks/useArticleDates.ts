import { useEffect, useState } from 'react';
import { firstEditDate } from '../services/articleService';

interface State {
  title: string;
  firstEdit: string | null;
  error: string | null;
}

export function useArticleDates(title: string) {
  const [state, setState] = useState<State>({ title: '', firstEdit: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ title, firstEdit: null, error: null });
    firstEditDate(title, controller.signal)
      .then((firstEdit) => {
        if (!controller.signal.aborted) setState({ title, firstEdit, error: null });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setState({ title, firstEdit: null, error: error.message });
      });
    return () => controller.abort();
  }, [title]);

  // Never apply the previous article's date while the new lookup is pending.
  const current = state.title === title;
  return {
    firstEdit: current ? state.firstEdit : null,
    error: current ? state.error : null,
    loading: !current || (!state.firstEdit && !state.error),
  };
}
