import { useState, type FormEvent } from 'react';
import Header from './components/Header';
import ArticleSearch from './components/ArticleSearch';
import DateRangePicker from './components/DateRangePicker';
import ReviewProgress from './components/ReviewProgress';
import Summary from './components/Summary';
import ReviewHistory from './components/ReviewHistory';
import ChangeList from './components/ChangeList';
import { useComparison } from './hooks/useComparison';
import { useArticleDates } from './hooks/useArticleDates';

const DEFAULT_SEARCH = { title: 'Suomen sisällissota', from: '2015-01-01', to: '2015-03-01' };

function isValidRange(from: string, to: string, minDate: string | null, maxDate: string): boolean {
  const start = Date.parse(from), end = Date.parse(to);
  return minDate !== null && Date.parse(minDate) <= start && start < end && end <= Date.parse(maxDate);
}

export default function App() {
  const [title, setTitle] = useState(DEFAULT_SEARCH.title);
  const [from, setFrom] = useState(DEFAULT_SEARCH.from);
  const [to, setTo] = useState(DEFAULT_SEARCH.to);
  // The chosen article; the review only starts from the "Start review" button.
  const [article, setArticle] = useState(DEFAULT_SEARCH.title);
  // The started review, null until the first start; `requestId` lets Start review re-run an identical review.
  const [search, setSearch] = useState<typeof DEFAULT_SEARCH & { requestId: number } | null>(null);
  const { data, loading, error, progress, cancel } = useComparison(search?.title ?? '', search?.from ?? '', search?.to ?? '', search?.requestId);
  const { firstEdit, loading: datesLoading, error: datesError } = useArticleDates(article);
  const today = new Date().toISOString().split('T')[0];
  const validRange = isValidRange(from, to, firstEdit, today);
  // The result section that is shown; null shows neither.
  const [view, setView] = useState<'history' | 'review' | null>(null);

  function toggleView(next: 'history' | 'review') {
    setView((current) => (current === next ? null : next));
  }

  function startReview() {
    if (!validRange) return;
    setSearch((prev) => ({ title: article, from, to, requestId: (prev?.requestId ?? 0) + 1 }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim()) setArticle(title.trim());
  }

  function chooseSuggestion(chosen: string) {
    setTitle(chosen);
    setArticle(chosen);
  }

  return (
    <>
      <Header />
      <main>
        <ArticleSearch
          value={title}
          selectedTitle={article}
          disabled={!title.trim() || loading}
          onChange={setTitle}
          onSubmit={submitSearch}
          onChoose={chooseSuggestion}
        />
        <h1>{article}</h1>
        <p className="subtitle">Finnish Wikipedia · How the article’s framing changed over time</p>

        <DateRangePicker
          from={from}
          to={to}
          minDate={firstEdit}
          maxDate={today}
          onFromChange={setFrom}
          onToChange={setTo}
          showStart={!loading}
          startDisabled={!validRange}
          onStart={startReview}
        />

        {datesLoading && <p className="reading-note" role="status">Loading article dates…</p>}
        {datesError && <p className="message error" role="alert">Could not load article dates: {datesError}</p>}
        {from && to && firstEdit && !validRange && (
          <p className="message validation" role="status">
            Choose dates between {firstEdit} and {today}, with the first date earlier than the second.
          </p>
        )}
        {error && (
          <div className="message error" role="alert">
            <p>Could not load the comparison: {error}</p>
          </div>
        )}
        {loading && <ReviewProgress progress={progress} onCancel={cancel} />}

        {data && !loading && (
          <div aria-live="polite">
            <Summary comparison={data} />
            <div className="result-views">
              <button type="button" aria-pressed={view === 'history'} onClick={() => toggleView('history')}>history</button>
              <button type="button" aria-pressed={view === 'review'} onClick={() => toggleView('review')}>full review</button>
            </div>
            {view === 'history' && search && <ReviewHistory changes={data.analysis.changes} from={search.from} to={search.to} />}
            {view === 'review' && (
              <>
                <h2 id="changes-heading">Evidence from the revisions</h2>
                <ChangeList analysis={data.analysis} />
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
