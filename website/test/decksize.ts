// Verify minimum deck sizes: 50 for Premier / Eternal, 80 for Twin Suns,
// adjusted by the base (Thermal Oscillator -5, Data Vault +10). No maximum.
import { validateEternal, validateTwinSuns } from '../src/lib/validate';
import type { NormalizedDeck, RawCard, DeckCard } from '../src/lib/types';

let nextId = 1;
function card(set: string, number: string, name: string): RawCard {
  return { cardId: nextId++, cardName: name, defaultExpansionAbbreviation: set, defaultCardNumber: number, aspects: [5] };
}
function deck(count: number, base: string, leaders = 1): NormalizedDeck {
  const mainboard: DeckCard[] = [];
  for (let i = 1; i <= count; i++) {
    const c = card('LAW', String(i).padStart(3, '0'), `Card ${i}`);
    mainboard.push({ card: c, quantity: 1, cardId: c.cardId, name: c.cardName, set: 'LAW', number: String(i) });
  }
  return {
    title: 'test', author: '', url: '', formatCode: leaders === 2 ? 2 : 1,
    leaders: Array.from({ length: leaders }, (_, i) => card('LAW', `00${i + 1}`, `Leader ${i + 1}`)),
    base: card('JTL', '025', base), mainboard, sideboard: [],
  };
}

const cases: [string, number, string, boolean][] = [
  ['constructed', 50, 'Echo Base', true], ['constructed', 49, 'Echo Base', false],
  ['constructed', 45, 'Thermal Oscillator', true], ['constructed', 44, 'Thermal Oscillator', false],
  ['constructed', 60, 'Data Vault', true], ['constructed', 59, 'Data Vault', false],
  ['constructed', 75, 'Echo Base', true],
  ['twinSuns', 80, 'Echo Base', true], ['twinSuns', 79, 'Echo Base', false],
  ['twinSuns', 75, 'Thermal Oscillator', true], ['twinSuns', 74, 'Thermal Oscillator', false],
  ['twinSuns', 90, 'Data Vault', true], ['twinSuns', 89, 'Data Vault', false],
  ['twinSuns', 120, 'Echo Base', true],
];

let failed = 0;
for (const [kind, count, base, expectOk] of cases) {
  const v = kind === 'twinSuns' ? validateTwinSuns(deck(count, base, 2)) : validateEternal(deck(count, base));
  const sizeReasons = v.reasons.filter((r) => r.includes('must contain at least'));
  const ok = sizeReasons.length === 0;
  if (ok !== expectOk) failed++;
  console.log(`${ok === expectOk ? 'PASS' : 'FAIL'}  ${kind.padEnd(11)} ${String(count).padStart(3)} cards, ${base.padEnd(18)} ${ok ? 'ok' : sizeReasons[0]}`);
}
if (failed) { console.log(`${failed} case(s) failed`); process.exit(1); }
