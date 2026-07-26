import type { NormalizedDeck, DeckCard, RawCard, SetInfo } from './types';
import { detectFormat, type DeckFormat } from './normalize';
import { extractAlignment, cardIdentity, formatCardName, padNumber } from './cards';
import { PREMIER_SUSPENDED_CARDS, ETERNAL_BANNED_CARDS, setLegality } from './legality';

export interface DeckValidation {
  format: DeckFormat;
  formatLabel: string;
  valid: boolean;
  reasons: string[];
  notes: string[];
}

export interface CardRef {
  name: string;
  set: string;
  number: string;
  imagePath?: string; // defaultImagePath from the payload (swudb.com image source)
}

// A card appearing across decks beyond the combined copy limit.
export interface CopyViolation extends CardRef {
  total: number;
  limit: number;
  perDeck: number[]; // copies in deck 1, 2, 3
}

// A leader or base that must be unique across the three decks but isn't.
export interface DupViolation extends CardRef {
  kind: 'Leader' | 'Base';
  decks: number[]; // 1-based deck numbers it appears in
}

export interface TrilogyValidation {
  format: DeckFormat;
  formatLabel: string;
  valid: boolean;
  copyViolations: CopyViolation[];
  dupViolations: DupViolation[];
  formatReasons: string[]; // format-level problems (e.g. mixing Twin Suns with constructed)
  // Each deck validated against the trilogy's format (not its own classification).
  perDeck: { deck: NormalizedDeck; result: DeckValidation }[];
}

const FORMAT_LABEL: Record<DeckFormat, string> = {
  premier: 'Premier-style constructed',
  eternal: 'Eternal',
  twinSuns: 'Twin Suns',
};

function dedupe(reasons: string[]): string[] {
  return [...new Set(reasons)];
}

function copyKey(c: DeckCard): string {
  return c.cardId != null ? `id:${c.cardId}` : `name:${c.name}`;
}

function printingLabel(c: DeckCard): string {
  return `${c.name} (${c.set} ${c.number})`;
}

// Port of validate_constructed_structure (shared one-leader structure).
function validateConstructedStructure(deck: NormalizedDeck, maxCopies: number): string[] {
  const reasons: string[] = [];

  if (deck.leaders.length !== 1) {
    reasons.push(`Expected exactly 1 leader; found ${deck.leaders.length}.`);
  }
  if (deck.base === null) {
    reasons.push('Expected exactly 1 base; found 0.');
  }

  const mainCount = deck.mainboard.reduce((n, c) => n + c.quantity, 0);
  if (mainCount < 50) {
    reasons.push(`Main deck must contain at least 50 cards; found ${mainCount}.`);
  }
  const sbCount = deck.sideboard.reduce((n, c) => n + c.quantity, 0);
  if (sbCount > 10) {
    reasons.push(`Sideboard can contain at most 10 cards; found ${sbCount}.`);
  }

  reasons.push(...copyLimitReasons(deck, () => maxCopies));
  return reasons;
}

// Shared per-card copy cap. `limitFor` returns the max for a given card.
function copyLimitReasons(deck: NormalizedDeck, limitFor: (c: DeckCard) => number): string[] {
  const reasons: string[] = [];
  const totals = new Map<string, number>();
  const all = [...deck.mainboard, ...deck.sideboard];
  for (const c of all) {
    totals.set(copyKey(c), (totals.get(copyKey(c)) ?? 0) + c.quantity);
  }
  for (const c of all) {
    const key = copyKey(c);
    const total = totals.get(key) ?? 0;
    const max = limitFor(c);
    if (total > max) {
      reasons.push(`${printingLabel(c)} exceeds the ${max}-copy limit with ${total} copies.`);
      totals.set(key, -1); // report each card once
    }
  }
  return reasons;
}

// Port of validate_premier, including the reprint rule: a printing from a
// non-legal set still passes if its full name (Name - Subtitle) is printed in
// any Premier-legal set (pool from carddata.buildPremierReprintNames). When
// the pool is unavailable (local data not exported / unreachable), such cards
// are flagged as a verify-manually note instead of silently passing or failing.
export function validatePremier(
  deck: NormalizedDeck,
  catalog: SetInfo[],
  reprintNames: Set<string> | null = null,
): DeckValidation {
  const reasons = validateConstructedStructure(deck, 3);
  const notes: string[] = [];

  for (const entry of [...deck.mainboard, ...deck.sideboard]) {
    if (PREMIER_SUSPENDED_CARDS.has(entry.name)) {
      reasons.push(`${printingLabel(entry)} is suspended in Premier.`);
      continue;
    }
    if (setLegality(entry.set, catalog).premier) continue;
    if (reprintNames === null) {
      notes.push(
        `${printingLabel(entry)} is from ${entry.set}, which is not Premier-legal. ` +
          `If the card has a Premier-legal reprint it is still legal — verify manually.`,
      );
      continue;
    }
    if (reprintNames.has(entry.name.trim().toLowerCase())) continue;
    reasons.push(
      `${printingLabel(entry)} is from ${entry.set}, which is not Premier-legal, ` +
        `and the card has no sourced Premier-legal reprint.`,
    );
  }

  return {
    format: 'premier',
    formatLabel: FORMAT_LABEL.premier,
    valid: reasons.length === 0,
    reasons: dedupe(reasons),
    notes,
  };
}

// Port of validate_twin_suns.
export function validateTwinSuns(deck: NormalizedDeck): DeckValidation {
  const reasons: string[] = [];

  if (deck.leaders.length !== 2) {
    reasons.push(`Twin Suns requires exactly 2 leaders; found ${deck.leaders.length}.`);
  }
  if (deck.base === null) {
    reasons.push('Twin Suns requires exactly 1 base; found 0.');
  }

  const mainCount = deck.mainboard.reduce((n, c) => n + c.quantity, 0);
  if (mainCount < 80) {
    reasons.push(`Twin Suns main deck must contain at least 80 cards; found ${mainCount}.`);
  }

  if (deck.leaders.length === 2) {
    const alignments = deck.leaders.map(extractAlignment).filter((a) => a !== null);
    if (alignments.length === 2 && alignments[0] !== alignments[1]) {
      reasons.push('Twin Suns leaders must not mix Heroism and Villainy on their front side.');
    }
  }

  reasons.push(
    ...copyLimitReasons(deck, (c) => {
      const max = c.card.alternativeDeckMaximum;
      return typeof max === 'number' && max > 0 ? max : 1;
    }),
  );

  return {
    format: 'twinSuns',
    formatLabel: FORMAT_LABEL.twinSuns,
    valid: reasons.length === 0,
    reasons: dedupe(reasons),
    notes: [],
  };
}

// Eternal: every released set is legal (incl. rotated sets and TS26), 3-copy
// limit, but JTL 140 (IG-2000) and JTL 170 (War Juggernaut) are banned.
export function validateEternal(deck: NormalizedDeck): DeckValidation {
  const reasons = validateConstructedStructure(deck, 3);
  for (const entry of [...deck.mainboard, ...deck.sideboard]) {
    if (ETERNAL_BANNED_CARDS.has((entry.card.cardName ?? '').toLowerCase())) {
      reasons.push(`${printingLabel(entry)} is banned in Eternal.`);
    }
  }
  return {
    format: 'eternal',
    formatLabel: FORMAT_LABEL.eternal,
    valid: reasons.length === 0,
    reasons: dedupe(reasons),
    notes: [],
  };
}

// A constructed deck is Premier only if every printing it uses (leaders, base,
// main, side) is from a Premier-legal set or has a Premier-legal reprint by
// full name. Otherwise — rotated sets (SOR/SHD/TWI) or TS26 cards — it's an
// Eternal deck.
function isPremierLegalPool(
  deck: NormalizedDeck,
  catalog: SetInfo[],
  reprintNames: Set<string> | null,
): boolean {
  const cards: { set: string; name: string }[] = [];
  for (const l of deck.leaders) {
    cards.push({ set: (l.defaultExpansionAbbreviation ?? '').toUpperCase(), name: formatCardName(l) });
  }
  if (deck.base) {
    cards.push({
      set: (deck.base.defaultExpansionAbbreviation ?? '').toUpperCase(),
      name: formatCardName(deck.base),
    });
  }
  for (const c of [...deck.mainboard, ...deck.sideboard]) cards.push({ set: c.set, name: c.name });
  return cards.every(
    (c) =>
      setLegality(c.set, catalog).premier ||
      (reprintNames !== null && reprintNames.has(c.name.trim().toLowerCase())),
  );
}

// A deck's format: Twin Suns (2 leaders), else Premier if the whole pool is
// Premier-legal, else Eternal.
export function classifyDeck(
  deck: NormalizedDeck,
  catalog: SetInfo[],
  reprintNames: Set<string> | null = null,
): DeckFormat {
  if (detectFormat(deck) === 'twinSuns') return 'twinSuns';
  return isPremierLegalPool(deck, catalog, reprintNames) ? 'premier' : 'eternal';
}

// Validate a deck against a specific format (used inside a trilogy, where every
// deck is judged by the trilogy's format — e.g. an Eternal trilogy applies the
// Eternal banlist to its Premier decks too).
export function validateDeckAs(
  deck: NormalizedDeck,
  format: DeckFormat,
  catalog: SetInfo[],
  reprintNames: Set<string> | null = null,
): DeckValidation {
  if (format === 'twinSuns') return validateTwinSuns(deck);
  if (format === 'eternal') return validateEternal(deck);
  return validatePremier(deck, catalog, reprintNames);
}

export function validateDeck(
  deck: NormalizedDeck,
  catalog: SetInfo[],
  reprintNames: Set<string> | null = null,
): DeckValidation {
  return validateDeckAs(deck, classifyDeck(deck, catalog, reprintNames), catalog, reprintNames);
}

// ---- Trilogy cross-deck rules (port of trilogy_validator.py) ----

// Find leaders/bases that repeat across decks. `cardsFor` yields the relevant
// RawCards for a deck (1-2 leaders, or 0-1 base).
function findDupViolations(
  decks: NormalizedDeck[],
  cardsFor: (d: NormalizedDeck) => RawCard[],
  kind: 'Leader' | 'Base',
): DupViolation[] {
  const seen = new Map<string, { decks: Set<number>; ref: CardRef }>();
  decks.forEach((deck, i) => {
    for (const card of cardsFor(deck)) {
      const [set, number] = cardIdentity(card);
      const id = `${set} ${number}`;
      const rec = seen.get(id) ?? {
        decks: new Set<number>(),
        ref: { name: formatCardName(card), set, number, imagePath: card.defaultImagePath },
      };
      rec.decks.add(i + 1);
      seen.set(id, rec);
    }
  });
  const out: DupViolation[] = [];
  for (const { decks: deckSet, ref } of seen.values()) {
    if (deckSet.size > 1) out.push({ ...ref, kind, decks: [...deckSet].sort() });
  }
  return out;
}

// Combined copy limit across all three decks (3 for Premier, 1 for Twin Suns).
function combinedCopyViolations(decks: NormalizedDeck[], limit: number): CopyViolation[] {
  interface Agg {
    ref: CardRef;
    perDeck: number[];
    total: number;
  }
  const byKey = new Map<string, Agg>();
  decks.forEach((deck, i) => {
    for (const c of [...deck.mainboard, ...deck.sideboard]) {
      const key = copyKey(c);
      const agg = byKey.get(key) ?? {
        ref: { name: c.name, set: c.set, number: c.number, imagePath: c.card.defaultImagePath },
        perDeck: [0, 0, 0],
        total: 0,
      };
      agg.perDeck[i] += c.quantity;
      agg.total += c.quantity;
      byKey.set(key, agg);
    }
  });
  const out: CopyViolation[] = [];
  for (const agg of byKey.values()) {
    if (agg.total > limit) out.push({ ...agg.ref, total: agg.total, limit, perDeck: agg.perDeck });
  }
  // Heaviest offenders first.
  out.sort((a, b) => b.total - a.total);
  return out;
}

const TRILOGY_LABEL: Record<DeckFormat, string> = {
  premier: 'Premier Trilogy',
  eternal: 'Eternal Trilogy',
  twinSuns: 'Twin Suns Trilogy',
};

// Validate exactly three decks as a Trilogy.
//
// Format rules:
//  - Twin Suns (2-leader) decks cannot mix with constructed decks — a trilogy is
//    all Twin Suns or all constructed.
//  - A constructed trilogy is Premier only if all three decks are Premier; if any
//    deck is Eternal it is an Eternal trilogy (Premier decks are allowed there).
//  - Combined copy limit: 1 for Twin Suns, 3 for Premier/Eternal.
export function validateTrilogy(
  decks: [NormalizedDeck, NormalizedDeck, NormalizedDeck],
  catalog: SetInfo[],
  reprintNames: Set<string> | null = null,
): TrilogyValidation {
  const formats = decks.map((d) => classifyDeck(d, catalog, reprintNames));
  const twinCount = formats.filter((f) => f === 'twinSuns').length;

  // Twin Suns may not be combined with Premier/Eternal. Show each deck under its
  // own format so the mismatch is visible.
  if (twinCount > 0 && twinCount < 3) {
    return {
      format: 'twinSuns',
      formatLabel: 'Invalid Trilogy',
      valid: false,
      copyViolations: [],
      dupViolations: [],
      formatReasons: [
        'Twin Suns decks (two leaders) cannot be combined with Premier or Eternal decks. ' +
          'All three decks must be Twin Suns, or all three must be Premier/Eternal.',
      ],
      perDeck: decks.map((deck, i) => ({
        deck,
        result: validateDeckAs(deck, formats[i], catalog, reprintNames),
      })),
    };
  }

  const format: DeckFormat =
    twinCount === 3 ? 'twinSuns' : formats.every((f) => f === 'premier') ? 'premier' : 'eternal';
  const limit = format === 'twinSuns' ? 1 : 3;

  // Every deck is judged by the trilogy's format. In an Eternal trilogy this
  // applies Eternal rules (incl. the banlist) to Premier decks too.
  const perDeck = decks.map((deck) => ({
    deck,
    result: validateDeckAs(deck, format, catalog, reprintNames),
  }));

  const dupViolations = [
    ...findDupViolations(decks, (d) => d.leaders, 'Leader'),
    ...findDupViolations(decks, (d) => (d.base ? [d.base] : []), 'Base'),
  ];
  const copyViolations = combinedCopyViolations(decks, limit);

  return {
    format,
    formatLabel: TRILOGY_LABEL[format],
    valid:
      perDeck.every((p) => p.result.valid) &&
      dupViolations.length === 0 &&
      copyViolations.length === 0,
    copyViolations,
    dupViolations,
    formatReasons: [],
    perDeck,
  };
}

export { padNumber };
