import { useState } from 'react';
import { decodeEntities, type Token } from '../utils/wikitext';
import ExternalLink from './ExternalLink';

const NEWLINE = '\n';

/** Collapsed markup (reference, template, table…); hover or click shows its wikitext. */
function Chip({ label, raw }: { label: string; raw: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="chip" title={raw} aria-expanded={open} onClick={() => setOpen(!open)}>{label}</button>
      {open && <code className="chip-raw">{raw}</code>}
    </>
  );
}

/** Wikitext the way the article reads: links as their labels, other markup as chips. */
export default function WikiText({ tokens }: { tokens: Token[] }) {
  // Hidden markup and empty paragraphs would otherwise leave blank lines behind.
  let lineHasContent = false;
  return (
    <>
      {tokens.map((token, index) => {
        if (token.kind === 'hidden') return null;
        if (token.kind === 'break' || token.raw.includes(NEWLINE) && token.raw.trim() === '') {
          const lineEnd = lineHasContent ? NEWLINE : null;
          lineHasContent = false;
          return lineEnd;
        }
        if (token.raw.trim() !== '') lineHasContent = true;
        switch (token.kind) {
          case 'text': return decodeEntities(token.raw);
          case 'link': return <ExternalLink key={index} className="wikilink" href={token.href}>{token.label}</ExternalLink>;
          case 'chip': return <Chip key={index} label={token.label} raw={token.raw} />;
        }
      })}
    </>
  );
}
