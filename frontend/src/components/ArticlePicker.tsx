import { useEffect, useState, type FormEvent } from 'react';
import { searchPages } from '../services/articleService';
import type { PageMatch } from '../types';

interface Props {
  title: string;
  onSelect: (title: string) => void;
}

/** Title box with suggestions from /pages/search. */
export default function ArticlePicker({ title, onSelect }: Props) {
  const [text, setText] = useState(title);
  const [matches, setMatches] = useState<PageMatch[]>([]);

  useEffect(() => setText(title), [title]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPages(q, controller.signal)
        .then(setMatches)
        .catch(() => {}); // suggestions are optional
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  function change(value: string) {
    setText(value);
    // Picking a suggestion from the list loads it straight away.
    if (matches.some((m) => m.title === value)) onSelect(value);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim()) onSelect(text.trim());
  }

  return (
    <form className="article-picker" onSubmit={submit} role="search">
      <label htmlFor="article-title">Article (Finnish Wikipedia)</label>
      <div>
        <input
          id="article-title"
          list="article-suggestions"
          value={text}
          onChange={(event) => change(event.target.value)}
          placeholder="e.g. Talvisota"
          autoComplete="off"
        />
        <button type="submit" className="compare-button">Show</button>
      </div>
      <datalist id="article-suggestions">
        {matches.map((m) => (
          <option key={m.page_id} value={m.title}>{`${m.n_versions} versions`}</option>
        ))}
      </datalist>
    </form>
  );
}
