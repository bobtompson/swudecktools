// Verify trilogy format determination + the Twin-Suns-can't-mix rule.
import { validateTrilogy } from '../src/lib/validate';
import type { NormalizedDeck, RawCard, DeckCard, SetInfo } from '../src/lib/types';

const catalog = (await (await fetch('https://api.swu-db.com/sets', {
  headers: { 'user-agent': 'swu-deck-tools' },
})).json()) as SetInfo[];

let id = 1;
const card = (set: string, num: string, name: string, extra: Partial<RawCard> = {}): RawCard => ({
  cardId: id++, cardName: name, defaultExpansionAbbreviation: set, defaultCardNumber: num, aspects: [1], ...extra,
});
const e = (c: RawCard, q: number): DeckCard => ({ card: c, quantity: q, cardId: c.cardId, name: c.cardName, set: c.defaultExpansionAbbreviation!, number: String(c.defaultCardNumber) });

// Each deck gets a unique tag so leaders/bases/cards don't collide across decks.
function premier(tag: string): NormalizedDeck {
  const main: DeckCard[] = [];
  for (let i = 1; i <= 17; i++) main.push(e(card('LAW', `${tag}${100 + i}`, `Card ${tag}-${i}`), 3)); // 51 cards
  return { title: `P-${tag}`, author: '', url: '', formatCode: 1,
    leaders: [card('LAW', `${tag}01`, `Ldr ${tag}`)], base: card('JTL', `${tag}02`, `Base ${tag}`),
    mainboard: main, sideboard: [] };
}
function eternal(tag: string): NormalizedDeck {
  const d = premier(tag); d.title = `E-${tag}`;
  d.mainboard.push(e(card('SOR', `${tag}90`, `Old ${tag}`), 1)); // rotated card -> Eternal
  return d;
}
// A Premier-legal deck (all sets 4+) that happens to run an Eternal-banned card.
function premierWithBan(tag: string): NormalizedDeck {
  const d = premier(tag); d.title = `P-${tag}(ban)`;
  d.mainboard.push(e(card('JTL', '140', 'IG-2000'), 1));
  return d;
}
function twin(tag: string): NormalizedDeck {
  const d = premier(tag); d.title = `TS-${tag}`; d.formatCode = 2;
  d.leaders = [card('TS26', `${tag}01`, `TLdr ${tag}`), card('TS26', `${tag}03`, `TLdr2 ${tag}`)];
  const main: DeckCard[] = [];
  for (let i = 1; i <= 80; i++) main.push(e(card('TS26', `${tag}${200 + i}`, `T ${tag}-${i}`), 1)); // 80 singletons
  d.mainboard = main;
  return d;
}

type Tri = [NormalizedDeck, NormalizedDeck, NormalizedDeck];
const cases: [string, Tri][] = [
  ['3 premier', [premier('a'), premier('b'), premier('c')]],
  ['2 premier + 1 eternal', [premier('a'), premier('b'), eternal('c')]],
  ['3 eternal', [eternal('a'), eternal('b'), eternal('c')]],
  ['3 twin suns', [twin('a'), twin('b'), twin('c')]],
  ['2 twin suns + 1 premier (illegal mix)', [twin('a'), twin('b'), premier('c')]],
  ['1 twin suns + 2 eternal (illegal mix)', [twin('a'), eternal('b'), eternal('c')]],
  ['premier+IG-2000 alone (Premier Trilogy, legal)', [premierWithBan('a'), premier('b'), premier('c')]],
  ['premier+IG-2000 in an Eternal trilogy (banned)', [premierWithBan('a'), eternal('b'), eternal('c')]],
];

for (const [label, decks] of cases) {
  const t = validateTrilogy(decks, catalog);
  console.log(`${t.formatLabel.padEnd(18)} ${t.valid ? 'VALID  ' : 'INVALID'}  — ${label}`);
  for (const r of t.formatReasons) console.log('      ! ' + r);
  // per-deck format the decks were judged under + any reasons
  t.perDeck.forEach((p, i) => {
    if (!p.result.valid) console.log(`      deck ${i + 1} [${p.result.format}] INVALID: ${p.result.reasons.join('; ')}`);
  });
}
