import { useState, type FormEvent } from 'react';
import Header from './components/Header';
import DateRangePicker from './components/DateRangePicker';
import RevisionCards from './components/RevisionCards';
import Summary from './components/Summary';
import ChangeList from './components/ChangeList';
import { useComparison } from './hooks/useComparison';

const DEFAULT_ARTICLE_TITLE = 'Suomen sisällissota';

export default function App() {
  const [from, setFrom] = useState('2015-01-01');
  const [to, setTo] = useState('2015-03-01');
  const [title, setTitle] = useState(DEFAULT_ARTICLE_TITLE);
  const [search, setSearch] = useState({ title: DEFAULT_ARTICLE_TITLE, from: '2015-01-01', to: '2015-03-01' });
  const { data, loading, error } = useComparison(search.title, search.from, search.to);
  const invalidSearch = !title.trim() || !from || !to || from >= to;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidSearch) return;
    setSearch({ title: title.trim(), from, to });
  }

  return (
    <>
      <Header />
      <main>
        <div className="page-tabs" aria-label="Article tools">
          <span className="page-tab active">Article history</span>
          <a className="page-tab" href="#date-picker-heading">Compare revisions</a>
        </div>
        <h1 id="article-heading">{search.title || 'Article changes'}</h1>
        <p className="subtitle">Finnish Wikipedia · How the article’s framing changed over time</p>

        <form onSubmit={submitSearch}>
          <label className="article-title-field" htmlFor="article-title">Article title
            <span className="article-search-row">
              <input id="article-title" value={title} onChange={(event) => setTitle(event.target.value)} />
              <button className="compare-button search-button" type="submit" disabled={invalidSearch || loading}>Search</button>
            </span>
          </label>
          <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </form>

        {from && to && from >= to && <p className="message validation" role="status">The first date needs to be earlier than the second.</p>}
        {error && <p className="message error" role="alert">Could not load the comparison: {error}</p>}
        {loading && <p className="message loading" role="status">Gemini is reading the changes…</p>}

        {data && !loading && (
          <>
            <div aria-live="polite" aria-busy={loading}>
            <RevisionCards comparison={data} />
            <Summary comparison={data} />
            <details className="remaining-changes">
              <summary>Why? View the changes and quoted evidence</summary>
              <h2 id="changes-heading">Evidence from the revisions</h2>
              <ChangeList comparison={data} />
            </details>
            </div>
          </>
        )}
      </main>
    </>
  );
}
