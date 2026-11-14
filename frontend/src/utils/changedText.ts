// Splits into words and keeps the whitespace between them as separate tokens.
const WORDS_AND_SPACES = /(\s+)/;

/**
 * Leaves only the words that differ between two versions of a paragraph, so text added
 * to an existing paragraph shows no "before". Null means that side has nothing.
 */
export function changedText(oldText: string | null, newText: string | null): { before: string | null; after: string | null } {
  if (!oldText || !newText) return { before: oldText, after: newText };
  const before = oldText.split(WORDS_AND_SPACES);
  const after = newText.split(WORDS_AND_SPACES);

  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (
    end < before.length - start && end < after.length - start
    && before[before.length - 1 - end] === after[after.length - 1 - end]
  ) end++;

  const middle = (tokens: string[]) => tokens.slice(start, tokens.length - end).join('').trim() || null;
  return { before: middle(before), after: middle(after) };
}
