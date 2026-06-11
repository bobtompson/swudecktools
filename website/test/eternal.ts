// Verify Premier vs Eternal classification + the Eternal banlist, using
// synthetic minimal decks against the live /sets catalog.
import { validateDeck } from '../src/lib/validate';
import type { NormalizedDeck, RawCard, DeckCard, SetInfo } from '../src/lib/types';

const catalog = (await (await fetch('https://api.swu-db.com/sets', {
  headers: { 'user-agent': 'swu-deck-tools' },
})).json()) as SetInfo[];

let nextId = 1;
function card(set: string, number: string, name: string, extra: Partial<RawCard> = {}): RawCard {
  return { cardId: nextId++, cardName: name, defaultExpansionAbbreviation: set, defaultCardNumber: number, aspects: [1], ...extra };
}
function entry(c: RawCard, qty: number): DeckCard {
  return { card: c, quantity: qty, cardId: c.cardId, name: c.cardName, set: c.defaultExpansionAbbreviation!, number: String(c.defaultCardNumber) };
}
// 50-card mainboard from a single legal-set card (LAW) at 3x + filler legal cards.
function deck(extraMain: DeckCard[], leaderSet = 'SEC', baseSet = 'JTL'): NormalizedDeck {
  const filler: DeckCard[] = [];
  for (let i = 1; i <= 20; i++) filler.push(entry(card('LAW', String(i).padStart(3, '0'), `Law Card ${i}`), 3)); // 60 cards
  return {
    title: 'test', author: '', url: '', formatCode: 1,
    leaders: [card(leaderSet, '006', 'Test Leader')],
    base: card(baseSet, '027', 'Test Base'),
    mainboard: [...filler, ...extraMain], sideboard: [],
  };
}

const IG2000 = entry(card('JTL', '140', 'IG-2000'), 1);
const SOR_CARD = entry(card('SOR', '050', 'Old Spark Card'), 1);

const cases: [string, NormalizedDeck][] = [
  ['all sets 4+ (should be Premier)', deck([])],
  ['has an SOR card (should be Eternal, valid)', deck([SOR_CARD])],
  ['Premier deck + IG-2000 (Premier-legal, valid)', deck([IG2000])],
  ['Eternal deck (SOR) + IG-2000 (banned in Eternal)', deck([SOR_CARD, IG2000])],
  ['TS26 leader (should be Eternal)', deck([], 'TS26')],
];

for (const [label, d] of cases) {
  const v = validateDeck(d, catalog);
  console.log(`${v.formatLabel.padEnd(28)} ${v.valid ? 'VALID  ' : 'INVALID'}  — ${label}`);
  for (const r of v.reasons) console.log('      - ' + r);
}
