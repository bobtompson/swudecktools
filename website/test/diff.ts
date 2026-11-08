// Deck diff parity check: fetch two real decks (node fetch — no CORS
// server-side), run the ported diff, and print the markdown. Compare against
// the Python CLI with:
//   cd ~/github/swu-tools && uv run python deck_diff.py <old> <new> --markdown
// Everything after the CLI's "Command:" block should match line for line.
//
//   npx tsx test/diff.ts [oldDeckId] [newDeckId]
import { normalizeDeck } from '../src/lib/normalize';
import { diffDecks, diffToMarkdown } from '../src/lib/diff';
import type { RawDeck } from '../src/lib/types';

const OLD_ID = process.argv[2] ?? 'oDEIxoWTsm';
const NEW_ID = process.argv[3] ?? 'YezSwWFyp';

async function rawDeck(id: string): Promise<RawDeck> {
  const r = await fetch(`https://www.swudb.com/api/deck/${id}`);
  if (!r.ok) throw new Error(`deck ${id}: HTTP ${r.status}`);
  return (await r.json()) as RawDeck;
}

const [oldDeck, newDeck] = await Promise.all([OLD_ID, NEW_ID].map(async (id) => normalizeDeck(await rawDeck(id))));
process.stdout.write(diffToMarkdown(diffDecks(oldDeck, newDeck)));

// Same deck on both sides must report no changes.
const same = diffDecks(newDeck, newDeck);
if (same.sections.length || same.added || same.removed) {
  console.error('FAIL: identical decks produced a diff');
  process.exit(1);
}
