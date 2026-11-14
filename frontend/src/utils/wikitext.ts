/** Wikitext -> tokens for display. Joining every token's `raw` gives back the input. */

export type Token =
  | { kind: 'text' | 'hidden' | 'break'; raw: string }
  | { kind: 'link'; raw: string; label: string; href: string }
  | { kind: 'chip'; raw: string; label: string };

const WIKI_ARTICLE_URL = 'https://fi.wikipedia.org/wiki/';
const MEDIA_PREFIX = /^(?:tiedosto|kuva|file|image):/i;
const CATEGORY_PREFIX = /^(?:luokka|category):/i;

const REF_LABEL = 'ref';
const TEMPLATE_LABEL = 'template';
const TABLE_LABEL = 'table';
const IMAGE_LABEL = 'image';
const COMMENT_LABEL = 'comment';
const CATEGORY_LABEL = 'category';

const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';
const TEMPLATE_OPEN = '{{';
const TEMPLATE_CLOSE = '}}';
const TABLE_OPEN = '{|';
const TABLE_CLOSE = '|}';
const LINK_OPEN = '[[';
const LINK_CLOSE = ']]';

// Sticky patterns: each is tried at the current position only.
const REF_OPEN = /<ref(?=[\s>/])[^>]*>/iy;
const REF_CLOSE = /<\/ref\s*>/iy;
const LINE_BREAK = /<br\s*\/?>/iy;
const HTML_TAG = /<\/?[a-z][^<>]*>/iy;
const EXTERNAL_LINK = /\[(https?:\/\/[^\s\]]+)[ \t]*([^\]\n]*)\]/y;
const EMPHASIS = /'{2,}/y;
const HEADING_OPEN = /={2,}[ \t]*/y;
const HEADING_CLOSE = /[ \t]*={2,}[ \t]*(?=\n|$)/y;
// A template parameter on its own line, as in infoboxes: "| nimi = ".
const PARAMETER_NAME = /(?<=(?:^|\n)[ \t]*)\|[ \t]*[^|=\n[\]{}<>"']+=[ \t]*/y;
const WHITESPACE = /\s+/y;
const WORD = /[^\s<>[\]{}|'=]+/y;
const EMPHASIS_MARKS = /'{2,}/g;
const LABEL_TAGS = /<\/?[a-z][^<>]*>/gi;
const SPACES = /\s+/g;

// &nbsp; &#160; &#xA0;
const ENTITY = /&(?:([a-z]+)|#(\d+)|#x([0-9a-f]+));/gi;
const HEX = 16;
const MAX_CODE_POINT = 0x10ffff;
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: '\u00a0', thinsp: '\u2009', shy: '\u00ad', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  ndash: '–', mdash: '—', minus: '−', times: '×', deg: '°', euro: '€', hellip: '…',
};

/** HTML entities as the characters they stand for; unknown ones are left as written. */
export function decodeEntities(text: string): string {
  return text.replace(ENTITY, (entity, name?: string, decimal?: string, hex?: string) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
    const codePoint = decimal ? Number(decimal) : parseInt(hex!, HEX);
    return codePoint <= MAX_CODE_POINT ? String.fromCodePoint(codePoint) : entity;
  });
}

function matchAt(pattern: RegExp, text: string, index: number): RegExpExecArray | null {
  pattern.lastIndex = index;
  return pattern.exec(text);
}

/** Index just past the closer of the pair opened at `start`, counting nested pairs; -1 when cut off. */
function pairEnd(text: string, start: number, open: string, close: string): number {
  let depth = 0;
  for (let i = start; i < text.length;) {
    if (text.startsWith(open, i)) {
      depth++;
      i += open.length;
    } else if (text.startsWith(close, i)) {
      depth--;
      i += close.length;
      if (depth === 0) return i;
    } else i++;
  }
  return -1;
}

/** Like pairEnd for a table; templates inside it may contain the table closer ("|}}"). */
function tableEnd(text: string, start: number): number {
  for (let i = start + TABLE_OPEN.length; i < text.length;) {
    if (text.startsWith(TEMPLATE_OPEN, i)) {
      const end = pairEnd(text, i, TEMPLATE_OPEN, TEMPLATE_CLOSE);
      if (end < 0) return -1;
      i = end;
    } else if (text.startsWith(TABLE_CLOSE, i)) return i + TABLE_CLOSE.length;
    else i++;
  }
  return -1;
}

/** A link label as plain text: tags (often <br> in infoboxes), emphasis marks and entities resolved. */
function plainLabel(label: string): string {
  return decodeEntities(label.replace(LABEL_TAGS, ' ').replace(EMPHASIS_MARKS, '')).replace(SPACES, ' ').trim();
}

function wikiLink(raw: string): Token {
  const [target, ...labelParts] = raw.slice(LINK_OPEN.length, -LINK_CLOSE.length).split('|');
  if (MEDIA_PREFIX.test(target.trim())) return { kind: 'chip', raw, label: IMAGE_LABEL };
  if (CATEGORY_PREFIX.test(target.trim())) {
    return { kind: 'chip', raw, label: `${CATEGORY_LABEL}: ${target.trim().replace(CATEGORY_PREFIX, '')}` };
  }
  const page = target.replace(/^:/, '').trim();
  const label = plainLabel(labelParts.join('|')) || page;
  return { kind: 'link', raw, label, href: WIKI_ARTICLE_URL + encodeURI(page.replace(/ /g, '_')) };
}

function templateName(raw: string): string {
  const name = raw.slice(TEMPLATE_OPEN.length).split(/[|}\n]/)[0].trim();
  return name || TEMPLATE_LABEL;
}

/** A closer whose opener was cut off before this text: the label of what it closes, and its length. */
function strayCloser(text: string, i: number): { label: string; length: number } | null {
  const ref = matchAt(REF_CLOSE, text, i);
  if (ref) return { label: REF_LABEL, length: ref[0].length };
  if (text.startsWith(TEMPLATE_CLOSE, i)) return { label: TEMPLATE_LABEL, length: TEMPLATE_CLOSE.length };
  if (text.startsWith(TABLE_CLOSE, i) && !text.startsWith(TEMPLATE_CLOSE, i + 1)) {
    return { label: TABLE_LABEL, length: TABLE_CLOSE.length };
  }
  return null;
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  // Markup cut off at the end of the text still becomes one chip.
  const chip = (end: number, label: string) => {
    const stop = end < 0 ? text.length : end;
    tokens.push({ kind: 'chip', raw: text.slice(i, stop), label });
    i = stop;
  };
  const plain = (kind: 'text' | 'hidden' | 'break', length: number) => {
    tokens.push({ kind, raw: text.slice(i, i + length) });
    i += length;
  };

  while (i < text.length) {
    const atLineStart = i === 0 || text[i - 1] === '\n';
    const stray = strayCloser(text, i);
    let match: RegExpExecArray | null;

    if (stray) {
      // Everything before a closer without an opener is the rest of that markup.
      tokens.length = 0;
      tokens.push({ kind: 'chip', raw: text.slice(0, i + stray.length), label: stray.label });
      i += stray.length;
    } else if (text.startsWith(COMMENT_OPEN, i)) {
      const close = text.indexOf(COMMENT_CLOSE, i);
      chip(close < 0 ? close : close + COMMENT_CLOSE.length, COMMENT_LABEL);
    } else if ((match = matchAt(REF_OPEN, text, i))) {
      if (match[0].endsWith('/>')) chip(i + match[0].length, REF_LABEL);
      else {
        let close = i + match[0].length;
        while (close < text.length && !matchAt(REF_CLOSE, text, close)) close++;
        const closer = matchAt(REF_CLOSE, text, close);
        chip(closer ? close + closer[0].length : -1, REF_LABEL);
      }
    } else if (text.startsWith(TEMPLATE_OPEN, i)) {
      const end = pairEnd(text, i, TEMPLATE_OPEN, TEMPLATE_CLOSE);
      chip(end, templateName(text.slice(i)));
    } else if (text.startsWith(TABLE_OPEN, i)) {
      chip(tableEnd(text, i), TABLE_LABEL);
    } else if (text.startsWith(LINK_OPEN, i) && pairEnd(text, i, LINK_OPEN, LINK_CLOSE) > 0) {
      const end = pairEnd(text, i, LINK_OPEN, LINK_CLOSE);
      tokens.push(wikiLink(text.slice(i, end)));
      i = end;
    } else if ((match = matchAt(EXTERNAL_LINK, text, i))) {
      tokens.push({ kind: 'link', raw: match[0], label: plainLabel(match[2]) || match[1], href: match[1] });
      i += match[0].length;
    } else if ((match = matchAt(LINE_BREAK, text, i))) plain('break', match[0].length);
    else if ((match = matchAt(HTML_TAG, text, i))) plain('hidden', match[0].length);
    else if ((match = matchAt(EMPHASIS, text, i))) plain('hidden', match[0].length);
    else if (atLineStart && (match = matchAt(HEADING_OPEN, text, i))) plain('hidden', match[0].length);
    else if ((match = matchAt(HEADING_CLOSE, text, i))) plain('hidden', match[0].length);
    else if ((match = matchAt(PARAMETER_NAME, text, i))) plain('hidden', match[0].length);
    else if ((match = matchAt(WHITESPACE, text, i))) plain('text', match[0].length);
    else if ((match = matchAt(WORD, text, i))) plain('text', match[0].length);
    else plain('text', 1);
  }
  return tokens;
}
