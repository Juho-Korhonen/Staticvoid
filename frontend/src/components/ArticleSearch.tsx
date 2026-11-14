import { useState, type FormEvent } from 'react';
import { useTitleSuggestions } from '../hooks/useTitleSuggestions';

interface Props {
  value: string;
  selectedTitle: string;
  disabled: boolean;
  onChange: (title: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChoose: (title: string) => void;
}

/** Article title input with autocomplete suggestions. */
export default function ArticleSearch({ value, selectedTitle, disabled, onChange, onSubmit, onChoose }: Props) {
  const [open, setOpen] = useState(false);
  const { suggestions, loading } = useTitleSuggestions(value, selectedTitle);
  const expanded = open && (loading || suggestions.length > 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    setOpen(false);
    onSubmit(event);
  }

  function choose(title: string) {
    setOpen(false);
    onChoose(title);
  }

  return (
    <form className="article-search" onSubmit={submit}>
      <div className="article-title-field">
        <label htmlFor="article-title">Search an article</label>
        <span className="article-search-row">
          <span className="article-search-input-wrap">
            <input
              id="article-title"
              value={value}
              placeholder="Search an article"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={expanded}
              aria-controls="article-suggestions"
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                onChange(event.target.value);
                setOpen(true);
              }}
            />
            {expanded && (
              <ul id="article-suggestions" className="article-suggestions" role="listbox">
                {loading && <li className="suggestions-status" role="option" aria-disabled="true">Searching…</li>}
                {suggestions.map((result) => (
                  <li key={result.page_id} role="option" aria-selected="false">
                    <button type="button" onClick={() => choose(result.title)}>
                      {result.title}
                      <small>{result.n_versions.toLocaleString()} saved versions</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </span>
          <button className="compare-button" type="submit" disabled={disabled}>Search</button>
        </span>
      </div>
    </form>
  );
}
