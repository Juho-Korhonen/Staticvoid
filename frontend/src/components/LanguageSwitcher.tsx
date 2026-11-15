import { useLanguage, type Language } from '../Language';

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'fi', label: 'Suomi' },
  { value: 'sv', label: 'Svenska' },
  { value: 'en', label: 'English' },
];

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <label className="language-switcher">
      <span className="language-icon" aria-hidden="true">文</span>
      <span className="visually-hidden">Language</span>
      <select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
        {OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
