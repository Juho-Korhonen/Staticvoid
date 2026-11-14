import type { RevisionInfo } from '../types';
import ExternalLink from './ExternalLink';

function Card({ title, revision }: { title: string; revision: RevisionInfo | null }) {
  return (
    <div className="card">
      <strong>{title}</strong>
      {revision
        ? <ExternalLink href={revision.url}>Revision of {revision.date} on Wikipedia ↗</ExternalLink>
        : <span>No revision existed on this date</span>}
    </div>
  );
}

export default function RevisionCards({ from, to }: { from: RevisionInfo | null; to: RevisionInfo | null }) {
  return (
    <div className="cards">
      <Card title="Earlier version" revision={from} />
      <Card title="Later version" revision={to} />
    </div>
  );
}
