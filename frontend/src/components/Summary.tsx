import type { Change } from '../types';

export default function Summary({ changes }: { changes: Change[] }) {
  const positive = changes.filter((c) => c.toneDelta > 0).length;
  const negative = changes.filter((c) => c.toneDelta < 0).length;
  const net = changes.reduce((sum, c) => sum + c.toneDelta, 0);

  return (
    <section className="summary" aria-label="Change summary">
      <div><strong>{changes.length}</strong>changes</div>
      <div><strong className="positive">{positive}</strong>more positive</div>
      <div><strong className="negative">{negative}</strong>more negative</div>
      <div><strong>{net > 0 ? `+${net}` : net}</strong>net tone shift</div>
    </section>
  );
}
