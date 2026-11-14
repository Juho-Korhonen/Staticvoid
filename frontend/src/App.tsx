import { useState, type FormEvent } from 'react';
import Header from './components/Header';
import ArticleSearch from './components/ArticleSearch';
import DateRangePicker from './components/DateRangePicker';
import ReviewProgress from './components/ReviewProgress';
import RevisionCards from './components/RevisionCards';
import Summary from './components/Summary';
import ChangeList from './components/ChangeList';
import { useComparison } from './hooks/useComparison';

const DEFAULT_SEARCH = { title: 'Suomen sisällissota', from: '2015-01-01', to: '2015-03-01' };

function isValidRange(from: string, to: string): boolean {
  return Boolean(from && to && from < to);
}

export default function App() {
  const [title, setTitle] = useState(DEFAULT_SEARCH.title);
  const [from, setFrom] = useState(DEFAULT_SEARCH.from);
  const [to, setTo] = useState(DEFAULT_SEARCH.to);
  // The submitted search; `requestId` re-runs an identical search.
  const [search, setSearch] = useState({ ...DEFAULT_SEARCH, requestId: 0 });
  const { data, loading, error, progress, cancel } = useComparison(search.title, search.from, search.to, search.requestId);
  const validRange = isValidRange(from, to);

  function updateRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (isValidRange(nextFrom, nextTo)) setSearch((current) => ({ ...current, from: nextFrom, to: nextTo }));
  }

  function runSearch(nextTitle: string) {
    if (!nextTitle || !validRange) return;
    setSearch((prev) => ({ title: nextTitle, from, to, requestId: prev.requestId + 1 }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(title.trim());
  }

  function chooseSuggestion(chosen: string) {
    setTitle(chosen);
    runSearch(chosen);
  }

  return (
    <>
      <Header />
      <main>
        <ArticleSearch
          value={title}
          selectedTitle={search.title}
          disabled={!title.trim() || !validRange || loading}
          onChange={setTitle}
          onSubmit={submitSearch}
          onChoose={chooseSuggestion}
        />
        <h1 id="article-heading">{search.title}</h1>
        <p className="subtitle">Finnish Wikipedia · How the article’s framing changed over time</p>

        <DateRangePicker from={from} to={to} onFromChange={(date) => updateRange(date, to)} onToChange={(date) => updateRange(from, date)} />

        {from && to && !validRange && <p className="message validation" role="status">The first date needs to be earlier than the second.</p>}
        {error && <p className="message error" role="alert">Could not load the comparison: {error}</p>}
        {error && progress?.totalChanges !== undefined && (
          <p className="reading-note">Incomplete review: {progress.reviewedChanges ?? 0} of {progress.totalChanges} passages inspected.</p>
        )}
        {loading && <ReviewProgress progress={progress} onCancel={cancel} />}

        {data && !loading && (
          <div aria-live="polite">
            <RevisionCards from={data.from} to={data.to} />
            <Summary comparison={data} />
            <details className="remaining-changes">
              <summary>View flagged edits and the full review</summary>
              <h2 id="changes-heading">Evidence from the revisions</h2>
              <ChangeList analysis={data.analysis} />
            </details>
          </div>
        )}
      </main>
    </>
  );
}
