import { useState } from 'react';
import type { ChangesResponse, WordChange } from '../types';

type Tab = 'words' | 'added' | 'removed';
const PAGE = 25;

/** Changes between the earlier and the later version (net_change). */
export default function ChangeList({ data }: { data: ChangesResponse }) {
  const [tab, setTab] = useState<Tab>('words');
  const [shown, setShown] = useState(PAGE);

  if (!data.final) {
    return <p className="message">The article did not exist yet on these dates. Try a later date.</p>;
  }
  if (data.summary.revisions === 0) {
    return <p className="message">The article did not change between these dates.</p>;
  }

  const net = data.net_change;
  // Whitespace-only edits (e.g. infobox alignment) are noise for a reader.
  const words = net.word_changes.filter((w) => w.before.trim() || w.after.trim());
  const lists: Record<Tab, number> = { words: words.length, added: net.added.length, removed: net.removed.length };
  const labels: Record<Tab, string> = { words: 'Wording', added: 'Paragraphs added', removed: 'Paragraphs removed' };

  function pick(next: Tab) {
    setTab(next);
    setShown(PAGE);
  }

  let items: JSX.Element[];
  if (tab === 'words') {
    items = words.slice(0, shown).map((w, i) => <li key={i}><WordEdit change={w} /></li>);
  } else {
    const lines = (tab === 'added' ? net.added : net.removed).slice(0, shown);
    items = lines.map((line, i) => (
      <li key={i}>
        <article className="change">
          <div className="change-copy">
            <p><span className="change-label">{tab === 'added' ? 'Added' : 'Removed'}</span><span className={tab}>{line || '(empty line)'}</span></p>
          </div>
        </article>
      </li>
    ));
  }

  return (
    <>
      <div className="change-filters" role="tablist" aria-label="Kind of change">
        {(Object.keys(lists) as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => pick(t)}>
            {labels[t]} <span>{lists[t]}</span>
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="message empty-filter">Nothing in this category.</p>
      ) : (
        <ol className="change-list" aria-labelledby="changes-heading">{items}</ol>
      )}
      {lists[tab] > shown && (
        <div className="presets">
          <button type="button" onClick={() => setShown(shown + PAGE)}>Show more ({lists[tab] - shown} left)</button>
        </div>
      )}
    </>
  );
}

function WordEdit({ change }: { change: WordChange }) {
  const [left, right = ''] = change.context.split('[[CHANGE]]');
  return (
    <article className="change">
      <div className="change-copy">
        <p>
          <span className="change-label">Edit</span>
          <span>
            …{left}
            {change.before && <span className="removed">{change.before}</span>}
            {change.after && <span className="added">{change.after}</span>}
            {right}…
          </span>
        </p>
      </div>
    </article>
  );
}
