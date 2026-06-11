// Ad-hoc parity check: fetch the real deck (node fetch — no CORS server-side),
// run the ported logic, and print the sorted + validation output to eyeball
// against the Python CLI.
import { normalizeDeck } from '../src/lib/normalize';
import { sortDeck, toMarkdown } from '../src/lib/sort';
import { validateDeck, validateTrilogy } from '../src/lib/validate';
import { fetchSets } from '../src/lib/swudb';
import type { RawDeck, SetInfo } from '../src/lib/types';

const DECK_ID = process.argv[2] ?? 'nFflVPWtxK';

async function rawDeck(id: string): Promise<RawDeck> {
  const r = await fetch(`https://www.swudb.com/api/deck/${id}`);
  return (await r.json()) as RawDeck;
}

async function rawSets(): Promise<SetInfo[]> {
  const r = await fetch('https://api.swu-db.com/sets');
  return (await r.json()) as SetInfo[];
}

const deck = normalizeDeck(await rawDeck(DECK_ID));
console.log('===== SORTED (markdown) =====');
console.log(toMarkdown(sortDeck(deck)));

console.log('\n===== VALIDATION =====');
const catalog = await rawSets().catch(() => fetchSets());
const v = validateDeck(deck, catalog);
console.log(`${v.formatLabel}: ${v.valid ? 'VALID' : 'INVALID'}`);
for (const r of v.reasons) console.log('  - ' + r);
for (const n of v.notes) console.log('  note: ' + n);

console.log('\n===== TRILOGY (same deck x3, expect dup leaders/bases) =====');
const t = validateTrilogy([deck, deck, deck], catalog);
console.log(`${t.formatLabel}: ${t.valid ? 'VALID' : 'INVALID'}`);
for (const d of t.dupViolations) console.log(`  - ${d.kind} ${d.name} (${d.set} ${d.number}) in decks ${d.decks.join(', ')}`);
for (const c of t.copyViolations)
  console.log(`  - ${c.name} (${c.set} ${c.number}): ${c.total}/${c.limit} [${c.perDeck.map((n, i) => `d${i + 1}:${n}`).join(' ')}]`);
