import { tokenize, type Token } from './wikitext';

const isBlank = (token: Token) => token.raw.trim() === '';
const isShown = (token: Token) => token.kind !== 'hidden' && !isBlank(token);

/** Without surrounding whitespace; null when nothing is left. */
function trimmed(tokens: Token[]): Token[] | null {
  const kept = [...tokens];
  while (kept.length && isBlank(kept[0])) kept.shift();
  while (kept.length && isBlank(kept[kept.length - 1])) kept.pop();
  if (!kept.length) return null;
  // A change of hidden markup only (e.g. bold marks) is shown as that markup.
  return kept.some(isShown) ? kept : [{ kind: 'text', raw: kept.map((token) => token.raw).join('') }];
}

/**
 * Leaves only the words and markup that differ between two versions of a paragraph, so text
 * added to an existing paragraph shows no "before". Null means that side has nothing.
 */
export function changedText(oldText: string | null, newText: string | null): { before: Token[] | null; after: Token[] | null } {
  const before = tokenize(oldText ?? '');
  const after = tokenize(newText ?? '');

  let start = 0;
  let end = 0;
  if (oldText && newText) {
    while (start < before.length && start < after.length && before[start].raw === after[start].raw) start++;
    while (
      end < before.length - start && end < after.length - start
      && before[before.length - 1 - end].raw === after[after.length - 1 - end].raw
    ) end++;
  }

  const middle = (tokens: Token[]) => trimmed(tokens.slice(start, tokens.length - end));
  return { before: middle(before), after: middle(after) };
}
