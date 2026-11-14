const entities = new Map([
  ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"],
  ['nbsp', ' '], ['ndash', '–'], ['mdash', '—'], ['hellip', '…'],
  ['laquo', '«'], ['raquo', '»'], ['lsquo', '‘'], ['rsquo', '’'],
  ['ldquo', '“'], ['rdquo', '”'],
]);

/** Simplify common Wikipedia formatting for display; always render as React text. */
export function readableWikiText(source: string): string {
  const text = source.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, value: string) => {
    if (!value.startsWith('#')) return entities.get(value.toLowerCase()) ?? entity;
    const code = value[1].toLowerCase() === 'x'
      ? parseInt(value.slice(2), 16) : parseInt(value.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code) : entity;
  });

  const linkLabel = (_match: string, link: string) => {
    const separator = link.indexOf('|');
    return separator < 0 ? link : link.slice(separator + 1) || link.slice(0, separator);
  };

  return text
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<ref\b[^>]*\/\s*>/gi, '')
    .replace(/<(script|style|ref)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    .replace(/<\/?(?:br|hr|p|div|center|li|tr|h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\[\[([^\[\]]+)\]\]/g, linkLabel)
    // Evidence passages may end partway through a wiki link.
    .replace(/\[\[([^\[\]\n]*)$/g, linkLabel)
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/gi, '$1')
    .replace(/'{2,5}/g, '')
    // Section headings: "=== Title ===" -> "Title".
    .replace(/^[ \t]*={2,6}[ \t]*(.*?)[ \t]*={2,6}[ \t]*$/gm, '$1')
    .replace(/^\s*\|\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
