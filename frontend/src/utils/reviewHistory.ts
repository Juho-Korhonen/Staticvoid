import type { Change, ChangeCategory } from '../types';
import { isFlagged } from './review';

const MAX_BUCKETS = 24;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_QUARTER = 3;
const MONTHS_PER_YEAR = 12;
const GROUPINGS = ['day', 'week', 'month', 'quarter', 'year'] as const;
type Grouping = typeof GROUPINGS[number];

interface Bucket {
  start: number;
  end: number;
  label: string;
  counts: Partial<Record<ChangeCategory, number>>;
}

function periodStart(timestamp: number, grouping: Grouping): Date {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  if (grouping === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK);
  if (grouping === 'month' || grouping === 'quarter' || grouping === 'year') date.setUTCDate(1);
  if (grouping === 'quarter') date.setUTCMonth(Math.floor(date.getUTCMonth() / MONTHS_PER_QUARTER) * MONTHS_PER_QUARTER);
  if (grouping === 'year') date.setUTCMonth(0);
  return date;
}

function nextPeriod(date: Date, grouping: Grouping, yearStep: number): Date {
  const next = new Date(date);
  if (grouping === 'day' || grouping === 'week') next.setUTCDate(next.getUTCDate() + (grouping === 'week' ? DAYS_PER_WEEK : 1));
  else next.setUTCMonth(next.getUTCMonth() + (grouping === 'year' ? MONTHS_PER_YEAR * yearStep : grouping === 'quarter' ? MONTHS_PER_QUARTER : 1));
  return next;
}

function makeBuckets(start: number, end: number, grouping: Grouping, yearStep: number): Bucket[] {
  const buckets: Bucket[] = [];
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', year: 'numeric', month: 'short',
    ...(grouping === 'day' || grouping === 'week' ? { day: 'numeric' as const } : {}),
  });
  for (let date = periodStart(start, grouping); +date < end && buckets.length <= MAX_BUCKETS;) {
    const next = nextPeriod(date, grouping, yearStep);
    const year = date.getUTCFullYear();
    const label = grouping === 'year'
      ? (yearStep === 1 ? String(year) : `${year}–${new Date(Math.min(+next, end) - 1).getUTCFullYear()}`)
      : grouping === 'quarter' ? `Q${Math.floor(date.getUTCMonth() / MONTHS_PER_QUARTER) + 1} ${year}` : format.format(date);
    buckets.push({ start: Math.max(+date, start), end: Math.min(+next, end), label, counts: {} });
    date = next;
  }
  return buckets;
}

/** Calendar buckets in UTC; count a revision once per category, even across split passages. */
export function reviewHistory(changes: Change[], from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!(start < end)) return null;
  let grouping: Grouping = 'day';
  let buckets: Bucket[] = [];
  let yearStep = 1;
  for (grouping of GROUPINGS) {
    if (grouping === 'year') yearStep = Math.ceil((new Date(end - 1).getUTCFullYear() - new Date(start).getUTCFullYear() + 1) / MAX_BUCKETS);
    buckets = makeBuckets(start, end, grouping, yearStep);
    if (buckets.length <= MAX_BUCKETS) break;
  }

  const seen = new Set<string>();
  const revisions = new Set<number>();
  const categories = new Set<ChangeCategory>();
  let undated = 0;
  for (const change of changes.filter(isFlagged)) {
    const revision = change.revision;
    const timestamp = Date.parse(revision?.timestamp ?? '');
    if (!revision || !Number.isFinite(timestamp)) { undated++; continue; }
    const bucket = buckets.find((period) => timestamp >= period.start && timestamp < period.end);
    const key = `${revision.id}:${change.category}`;
    if (!bucket || seen.has(key)) continue;
    seen.add(key);
    revisions.add(revision.id);
    categories.add(change.category);
    bucket.counts[change.category] = (bucket.counts[change.category] ?? 0) + 1;
  }
  return { buckets, categories: [...categories], grouping: yearStep > 1 ? `${yearStep}-year` : grouping, totalEdits: revisions.size, undated };
}
