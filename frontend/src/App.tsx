import { useState } from 'react';
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
  const [range, setRange] = useState({ from: '2015-01-01', to: '2015-03-01' });
  const [search, setSearch] = useState({ title: DEFAULT_ARTICLE_TITLE, from: '2015-01-01', to: '2015-03-01' });
  const { data, loading, error } = useComparison(search.title, search.from, search.to);

  function updateRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextFrom && nextTo && nextFrom <= nextTo) setRange({ from: nextFrom, to: nextTo });
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !range.from || !range.to) return;
    setSearch({ title: title.trim(), from: range.from, to: range.to });
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
        <p className="subtitle">From Wikipedia, the free encyclopedia · A look at how this article changed over time</p>

        <form onSubmit={submitSearch}>
          <label className="article-title-field" htmlFor="article-title">Article title
            <span className="article-search-row">
              <input id="article-title" value={title} onChange={(event) => setTitle(event.target.value)} />
              <button className="compare-button search-button" type="submit" disabled={!title.trim() || !range.from || !range.to || loading}>Search</button>
            </span>
          </label>
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
