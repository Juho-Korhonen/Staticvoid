import { useLanguage } from '../Language';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  const { t } = useLanguage();
  return (
    <header className="site-header">
      <div className="logo">
        Wiki the truth
        <small>{t('tagline')}</small>
      </div>
      <span className="mascot" role="img" aria-label={t('mascot')}>
        <svg viewBox="0 0 40 48" aria-hidden="true" focusable="false">
          <path className="flame-outer" d="M21 2c2 9-7 11-6 20-4-3-4-7-4-7C4 22 5 30 8 37c3 7 9 10 15 9 8-1 13-8 12-16-1-8-7-11-8-18-3 4-4 7-4 10-5-5 0-13-2-20Z" />
          <path className="flame-inner" d="M21 27c1 4-3 5-3 9 0 3 2 5 5 5s5-2 5-5c0-3-2-5-3-8-1 2-2 3-2 4-2-2-1-4-2-5Z" />
        </svg>
      </span>
      <LanguageSwitcher />
    </header>
  );
}
