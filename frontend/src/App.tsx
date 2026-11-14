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
  const [search, setSearch] = useState({ title: DEFAULT_ARTICLE_TITLE, from: '2015-01-01', to: '2015-03-01', requestId: 0 });
  const { data, loading, error, progress, cancel } = useComparison(search.title, search.from, search.to, search.requestId);
  const invalidSearch = !title.trim() || !from || !to || from >= to;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidSearch) return;
    setSearch((prev) => ({ title: title.trim(), from, to, requestId: prev.requestId + 1 }));
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
        {error && progress?.totalChanges !== undefined && <p className="reading-note">Incomplete review: {progress.reviewedChanges ?? 0} of {progress.totalChanges} passages inspected.</p>}
        {loading && <div className="message loading" role="status">
          <p>{progress?.stage === 'analyzing'
            ? `Inspecting every saved edit: ${progress.reviewedRevisions ?? 0}/${progress.totalRevisions ?? 0} revisions, ${progress.reviewedChanges ?? 0}/${progress.totalChanges ?? 0} passages. Batch ${progress.completedBatches ?? 0}/${progress.totalBatches ?? 0}.`
            : 'Loading all saved revisions and comparing each edit…'}</p>
          <button type="button" className="compare-button" onClick={cancel}>Cancel review</button>
        </div>}

        {data && !loading && (
          <>
            <div aria-live="polite" aria-busy={loading}>
            <RevisionCards comparison={data} />
            <Summary comparison={data} />
            <details className="remaining-changes">
              <summary>View flagged edits and the full review</summary>
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
