import type { ChangesResponse, RevisionBrief } from '../types';
import { formatBytes, formatDate, revisionUrl } from '../format';

function Card({ title, revision, empty }: { title: string; revision: RevisionBrief | null; empty: string }) {
  return (
    <div className="card">
      <strong>{title}</strong>
      {revision ? (
        <span>
          <a href={revisionUrl(revision.rev_id)} target="_blank" rel="noreferrer">
            Revision of {formatDate(revision.timestamp)}
          </a>
          {revision.bytes != null && ` · ${formatBytes(revision.bytes)}`}
        </span>
      ) : (
        <span>{empty}</span>
      )}
    </div>
  );
}

export default function RevisionCards({ data }: { data: ChangesResponse }) {
  return (
    <div className="cards">
      <Card title="Earlier version" revision={data.baseline} empty="The article did not exist yet" />
      <Card title="Later version" revision={data.final} empty="The article did not exist yet" />
    </div>
  );
}
