import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Language = 'en' | 'fi' | 'sv';
type Key = keyof typeof translations.en;

const translations = {
  en: {
    searchArticle: 'Search an article', search: 'Search', searching: 'Searching…', savedVersions: 'saved versions',
    fromDate: 'From date', toDate: 'To date', reviewPeriod: 'Review period', startReview: 'Start review',
    loading: 'Loading all saved revisions and comparing each edit…', inspecting: 'Inspecting every saved edit',
    cancelReview: 'Cancel review', compareSubtitle: 'Track who edits Finnish Wikipedia and uncover changes that could distort facts, spread propaganda, or manipulate public information.',
    howToStart: 'How to start', helpTitle: 'Explore how an article changed', helpIntro: 'Wiki the truth compares revisions of a Finnish Wikipedia article and highlights changes that may affect its framing.',
    helpStep1: 'Search for an article, or keep the example already selected.', helpStep2: 'Choose a date range and select', helpStep3: 'Read the summary, then open the history or full review to inspect the evidence.',
    helpNote: 'The review is a guide to changes, not a verdict. Check the linked revisions and sources yourself.', closeHelp: 'Close help',
    suspiciousFound: 'suspicious edits found', possibleAgenda: 'Possible agenda:', noAgenda: 'No agenda was established from the inspected wording.',
    revisionsBy: 'revisions by', editorsReviewed: 'editors reviewed. Flags need checking and don’t show intent; AI can make mistakes.', sources: 'Sources:', earlier: 'Earlier revision', later: 'Later revision', diff: 'Start-to-end diff ↗',
    history: 'history', fullReview: 'full review', evidence: 'Evidence from the revisions', suspiciousEditors: 'suspicious editors',
    dateError: 'Could not load article dates:', dateValidation: 'Choose dates between', and: 'and', comparisonError: 'Could not load the comparison:',
  },
  fi: {
    searchArticle: 'Hae artikkelia', search: 'Hae', searching: 'Haetaan…', savedVersions: 'tallennettua versiota',
    fromDate: 'Alkaen', toDate: 'Päättyen', reviewPeriod: 'Tarkastelujakso', startReview: 'Aloita tarkastelu',
    loading: 'Ladataan tallennettuja versioita ja vertaillaan muokkauksia…', inspecting: 'Tarkastellaan jokaista tallennettua muokkausta',
    cancelReview: 'Peruuta tarkastelu', compareSubtitle: 'Seuraa, kuka muokkaa suomenkielistä Wikipediaa, ja löydä muutoksia, jotka voivat vääristää tietoja, levittää propagandaa tai manipuloida julkista tietoa.',
    howToStart: 'Käyttöohje', helpTitle: 'Tutki artikkelin muutoksia', helpIntro: 'Wiki the truth vertaa suomenkielisen Wikipedia-artikkelin versioita ja nostaa esiin muutoksia, jotka voivat vaikuttaa sen esitystapaan.',
    helpStep1: 'Hae artikkelia tai käytä valittua esimerkkiä.', helpStep2: 'Valitse aikaväli ja napsauta', helpStep3: 'Lue yhteenveto ja avaa historia tai koko tarkastelu nähdäksesi todisteet.',
    helpNote: 'Tarkastelu auttaa tutkimaan muutoksia, mutta ei todista niiden tarkoitusta. Tarkista linkitetyt versiot ja lähteet.', closeHelp: 'Sulje ohje',
    suspiciousFound: 'epäilyttävää muokkausta löytyi', possibleAgenda: 'Mahdollinen pyrkimys:', noAgenda: 'Tarkastellusta tekstistä ei voitu päätellä pyrkimystä.',
    revisionsBy: 'versiota, muokkaajia:', editorsReviewed: 'tarkasteltu. Merkinnät on tarkistettava, eivätkä ne osoita tarkoitusta. Tekoäly voi erehtyä.',
    sources: 'Lähteet:', earlier: 'Aiempi versio', later: 'Myöhempi versio', diff: 'Muutosten vertailu ↗', history: 'historia', fullReview: 'koko tarkastelu', evidence: 'Versioista löytyneet todisteet', suspiciousEditors: 'epäilyttävät muokkaajat',
    dateError: 'Artikkelin päivämääriä ei voitu ladata:', dateValidation: 'Valitse päivämäärät väliltä', and: 'ja', comparisonError: 'Vertailua ei voitu ladata:',
  },
  sv: {
    searchArticle: 'Sök en artikel', search: 'Sök', searching: 'Söker…', savedVersions: 'sparade versioner',
    fromDate: 'Från datum', toDate: 'Till datum', reviewPeriod: 'Granskningsperiod', startReview: 'Starta granskning',
    loading: 'Läser in sparade versioner och jämför varje redigering…', inspecting: 'Granskar varje sparad redigering',
    cancelReview: 'Avbryt granskning', compareSubtitle: 'Följ vem som redigerar finskspråkiga Wikipedia och hitta ändringar som kan förvränga fakta, sprida propaganda eller manipulera offentlig information.',
    howToStart: 'Så här börjar du', helpTitle: 'Utforska hur en artikel har ändrats', helpIntro: 'Wiki the truth jämför versioner av en finskspråkig Wikipedia-artikel och lyfter fram ändringar som kan påverka dess framställning.',
    helpStep1: 'Sök efter en artikel eller använd det valda exemplet.', helpStep2: 'Välj ett datumintervall och klicka på', helpStep3: 'Läs sammanfattningen och öppna historiken eller hela granskningen för att se underlaget.',
    helpNote: 'Granskningen hjälper dig att undersöka ändringar men bevisar inte avsikten. Kontrollera de länkade versionerna och källorna.', closeHelp: 'Stäng hjälpen',
    suspiciousFound: 'misstänkta redigeringar hittades', possibleAgenda: 'Möjlig agenda:', noAgenda: 'Ingen agenda kunde fastställas utifrån den granskade formuleringen.',
    revisionsBy: 'versioner av', editorsReviewed: 'redigerare granskade. Markeringar måste kontrolleras och visar inte avsikt; AI kan ha fel.',
    sources: 'Källor:', earlier: 'Tidigare version', later: 'Senare version', diff: 'Jämför ändringarna ↗', history: 'historik', fullReview: 'fullständig granskning', evidence: 'Belägg från versionerna', suspiciousEditors: 'misstänkta redigerare',
    dateError: 'Kunde inte läsa in artikelns datum:', dateValidation: 'Välj datum mellan', and: 'och', comparisonError: 'Kunde inte läsa in jämförelsen:',
  },
} satisfies Record<Language, Record<string, string>>;

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: (key: Key) => string } | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('wiki-language');
    return saved === 'fi' || saved === 'sv' ? saved : 'en';
  });
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  function chooseLanguage(next: Language) {
    localStorage.setItem('wiki-language', next);
    setLanguage(next);
  }
  const t = (key: Key) => translations[language][key] ?? translations.en[key];
  return <LanguageContext.Provider value={{ language, setLanguage: chooseLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
