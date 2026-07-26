import type { NormalizedDeck, DeckCard, RawCard } from './types';
import { SET_ORDER, SUB_SET_ORDER } from './legality';
import { formatCardName, padNumber } from './cards';

// Wrap a leader/base RawCard as a single-copy DeckCard so it groups with the
// rest of the deck (the CLI lists leaders and base inside their set sections).
function asDeckCard(card: RawCard): DeckCard {
  return {
    card,
    quantity: 1,
    cardId: card.cardId,
    name: formatCardName(card),
    set: (card.defaultExpansionAbbreviation ?? '').toUpperCase(),
    number: padNumber(card.defaultCardNumber ?? ''),
  };
}

export interface SortedSet {
  set: string;
  cardCount: number; // total copies in this set
  cards: DeckCard[]; // sorted by card number
}

export interface SortedDeck {
  title: string;
  author: string;
  url: string;
  leaders: RawCard[];
  base: RawCard | null;
  sets: SortedSet[];
  totalCards: number;
}

// Merge identical (set, number) printings, summing quantities. Mainboard only —
// the sorted view mirrors the playable deck list.
function mergeByPrinting(cards: DeckCard[]): DeckCard[] {
  const byKey = new Map<string, DeckCard>();
  for (const c of cards) {
    const key = `${c.set}|${c.number}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += c.quantity;
    } else {
      byKey.set(key, { ...c });
    }
  }
  return [...byKey.values()];
}

// Order index for a set: main sets first, then sub sets, then unknown
// (alphabetical) after both.
function setRank(set: string): [number, string] {
  const main = SET_ORDER.indexOf(set);
  if (main !== -1) return [main, set];
  const sub = SUB_SET_ORDER.indexOf(set);
  if (sub !== -1) return [SET_ORDER.length + sub, set];
  return [SET_ORDER.length + SUB_SET_ORDER.length, set];
}

export function sortDeck(deck: NormalizedDeck): SortedDeck {
  // Leaders and base are listed within their set sections, like the CLI, which
  // also merges sideboard copies into the same by-set grouping.
  const leaderBase = [...deck.leaders.map(asDeckCard)];
  if (deck.base) leaderBase.push(asDeckCard(deck.base));
  const merged = mergeByPrinting([...leaderBase, ...deck.mainboard, ...deck.sideboard]);

  const bySet = new Map<string, DeckCard[]>();
  for (const c of merged) {
    const list = bySet.get(c.set) ?? [];
    list.push(c);
    bySet.set(c.set, list);
  }

  const sets: SortedSet[] = [...bySet.entries()]
    .map(([set, cards]) => {
      cards.sort((a, b) => a.number.localeCompare(b.number));
      const cardCount = cards.reduce((n, c) => n + c.quantity, 0);
      return { set, cardCount, cards };
    })
    .sort((a, b) => {
      const [ra, sa] = setRank(a.set);
      const [rb, sb] = setRank(b.set);
      return ra - rb || sa.localeCompare(sb);
    });

  return {
    title: deck.title,
    author: deck.author,
    url: deck.url,
    leaders: deck.leaders,
    base: deck.base,
    sets,
    totalCards: sets.reduce((n, s) => n + s.cardCount, 0),
  };
}

// Markdown rendering that mirrors the CLI output, for the "copy as markdown" action.
export function toMarkdown(sorted: SortedDeck): string {
  const lines: string[] = [];
  lines.push(`# ${sorted.title}`);
  lines.push('');
  if (sorted.author) lines.push(`**Author:** ${sorted.author}  `);
  lines.push(`**Source:** ${sorted.url}  `);
  lines.push('');
  for (const leader of sorted.leaders) {
    lines.push(`**Leader:** ${formatCardName(leader)} (${leader.defaultExpansionAbbreviation} ${padNumber(leader.defaultCardNumber ?? '')})  `);
  }
  if (sorted.base) {
    lines.push(`**Base:** ${formatCardName(sorted.base)} (${sorted.base.defaultExpansionAbbreviation} ${padNumber(sorted.base.defaultCardNumber ?? '')})  `);
  }
  lines.push('');
  lines.push('---');
  for (const s of sorted.sets) {
    lines.push('');
    lines.push(`## ${s.set} (${s.cardCount} CARDS)`);
    for (const c of s.cards) {
      const qty = c.quantity > 1 ? ` ×${c.quantity}` : '';
      lines.push(`- ${c.number}: ${c.name}${qty}`);
    }
  }
  return lines.join('\n');
}
