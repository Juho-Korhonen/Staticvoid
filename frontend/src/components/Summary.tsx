import type { Comparison } from '../types';
import { flaggedEditCount } from '../utils/review';
import ExternalLink from './ExternalLink';
import { useLanguage } from '../Language';

export default function Summary({ comparison }: { comparison: Comparison }) {
  const { analysis, revisionCount, editorCount } = comparison;
  const { sources } = analysis;
  const flaggedEdits = flaggedEditCount(analysis.changes);
  const { t } = useLanguage();

  return (
    <section className="reading" aria-label={t('geminiReading')}>
      <h2>{flaggedEdits > 0 ? `${flaggedEdits} ${t('suspiciousFound')}` : t(`neutrality.${analysis.overallNeutrality}`)}</h2>
      <p><strong>{t('possibleAgenda')}</strong> {analysis.possibleAgenda ?? t('noAgenda')}</p>
      <p className="reading-note">{revisionCount} {t('revisionsBy')} {editorCount} {t('editorsReviewed')}</p>
      <nav className="source-links" aria-label={t('wikipediaSources')}>
        <span>{t('sources')}</span>
        {sources.before && <ExternalLink href={sources.before}>{t('earlier')}</ExternalLink>}
        {sources.after && <ExternalLink href={sources.after}>{t('later')}</ExternalLink>}
        {sources.diff && <ExternalLink href={sources.diff}>{t('diff')}</ExternalLink>}
      </nav>
    </section>
  );
}
