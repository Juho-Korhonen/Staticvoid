import type { Comparison, RevisionInfo } from '../types';

function Card({ title, revision }: { title: string; revision: RevisionInfo | null }) {
  return (
    <div className="card">
      <strong>{title}</strong>
      <span>{revision ? `Revision of ${revision.date}` : 'No revision existed on this date'}</span>
    </div>
  );
}

export default function RevisionCards({ comparison }: { comparison: Comparison }) {
  return (
    <div className="cards">
      <Card title="Earlier version" revision={comparison.from} />
      <Card title="Later version" revision={comparison.to} />
    </div>
  );
}
