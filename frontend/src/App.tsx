import { useEffect, useState } from 'react';
import Header from './components/Header';
import DateRangePicker from './components/DateRangePicker';
import RevisionCards from './components/RevisionCards';
import Summary from './components/Summary';
import ChangeList from './components/ChangeList';
import { useComparison } from './hooks/useComparison';
import { searchArticles } from './services/articleService';
import type { PageSearchResult } from './types';

const DEFAULT_ARTICLE_TITLE = 'Suomen sisällissota';

export default function App() {
  const [from, setFrom] = useState('2015-01-01');
  const [to, setTo] = useState('2015-03-01');
  const [title, setTitle] = useState(DEFAULT_ARTICLE_TITLE);
  const [range, setRange] = useState({ from: '2015-01-01', to: '2015-03-01' });
  const [search, setSearch] = useState({ title: DEFAULT_ARTICLE_TITLE, from: '2015-01-01', to: '2015-03-01' });
  const [suggestions, setSuggestions] = useState<PageSearchResult[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { data, loading, error } = useComparison(search.title, search.from, search.to);

  useEffect(() => {
    const query = title.trim();
    if (query.length < 2 || query.toLocaleLowerCase() === search.title.toLocaleLowerCase()) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSuggestionsLoading(true);
      searchArticles(query, 8, controller.signal)
        .then((results) => setSuggestions(results))
        .catch((err: Error) => {
          if (err.name !== 'AbortError') setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggestionsLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [title, search.title]);

  function updateRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextFrom && nextTo && nextFrom <= nextTo) {
      setRange({ from: nextFrom, to: nextTo });
      setSearch((current) => ({ ...current, from: nextFrom, to: nextTo }));
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !range.from || !range.to) return;
    setSearch({ title: title.trim(), from: range.from, to: range.to });
    setShowSuggestions(false);
    setSuggestions([]);
  }

  function chooseSuggestion(result: PageSearchResult) {
    setTitle(result.title);
    if (range.from && range.to) {
      setSearch({ title: result.title, from: range.from, to: range.to });
    }
    setShowSuggestions(false);
    setSuggestions([]);
  }


  return (
    <>
      <Header />
      <main>
        <div className="page-tabs" aria-label="Article tools">
          <span className="page-tab active">Article history</span>
          <a className="page-tab" href="#date-picker-heading">Compare revisions</a>
        </div>
        <form className="article-search" onSubmit={submitSearch}>
          <div className="article-title-field">
            <label htmlFor="article-title">Search an article</label>
            <span className="article-search-row">
              <span className="article-search-input-wrap">
              <input id="article-title" value={title} placeholder="Search an article" autoComplete="off" aria-autocomplete="list" aria-expanded={showSuggestions && (suggestionsLoading || suggestions.length > 0)} aria-controls="article-suggestions" onFocus={() => setShowSuggestions(true)} onChange={(event) => { setTitle(event.target.value); setShowSuggestions(true); }} />
              {showSuggestions && title.trim().length >= 2 && (suggestionsLoading || suggestions.length > 0) && <ul id="article-suggestions" className="article-suggestions" role="listbox">
                {suggestionsLoading && <li className="suggestions-status" role="option" aria-disabled="true">Searching…</li>}
                {suggestions.map((result) => <li key={result.page_id} role="option" aria-selected="false">
                  <button type="button" onClick={() => chooseSuggestion(result)}>{result.title}<small>{result.n_versions.toLocaleString()} saved versions</small></button>
                </li>)}
              </ul>}
              </span>
              <button className="compare-button search-button" type="submit" disabled={!title.trim() || !range.from || !range.to || loading}>Search</button>
            </span>
          </div>
        </form>
        <h1 id="article-heading">{search.title || 'Article changes'}</h1>
        <p className="subtitle">From Wikipedia, the free encyclopedia · A look at how this article changed over time</p>

        <form onSubmit={submitSearch}>
          <DateRangePicker from={from} to={to} onFromChange={(date) => updateRange(date, to)} onToChange={(date) => updateRange(from, date)} />
        </form>

        {error && <p className="message error" role="alert">Could not load the comparison: {error}</p>}
        {loading && <p className="message loading" role="status">{data ? 'Updating comparison…' : 'Loading article history…'}</p>}

        {data && (
          <>
            <div aria-live="polite" aria-busy={loading}>
            <RevisionCards comparison={data} />
            <Summary changes={data.changes} />
            <h2 id="changes-heading">What changed</h2>
            <ChangeList comparison={data} />
            </div>
          </>
        )}
      </main>
    </>
  );
}
