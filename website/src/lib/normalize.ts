import type { RawDeck, RawCard, DeckCard, NormalizedDeck } from './types';
import { formatCardName, padNumber } from './cards';

// Accepts swudb.com / www.swudb.com /deck/{id} URLs (or a bare id) and returns
// the deck id. Port of is_swudb_url + extract_deck_id.
export function parseDeckUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Bare id (no slash, no scheme): accept as-is.
  if (!raw.includes('/') && !raw.includes(' ')) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== 'swudb.com' && host !== 'www.swudb.com') return null;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0] === 'deck') return parts[1];
  return null;
}

function toDeckCard(card: RawCard, quantity: number): DeckCard {
  return {
    card,
    quantity,
    cardId: card.cardId,
    name: formatCardName(card),
    set: (card.defaultExpansionAbbreviation ?? '').toUpperCase(),
    number: padNumber(card.defaultCardNumber ?? ''),
  };
}

// Port of normalize_deck: split shuffledDeck into mainboard / sideboard.
export function normalizeDeck(data: RawDeck): NormalizedDeck {
  const leaders = [data.leader, data.secondLeader].filter(
    (c): c is RawCard => Boolean(c),
  );

  const mainboard: DeckCard[] = [];
  const sideboard: DeckCard[] = [];

  for (const entry of data.shuffledDeck ?? []) {
    const card = entry.card;
    if (!card) continue;
    const count = entry.count ?? 0;
    const sbCount = entry.sideboardCount ?? 0;
    if (count > 0) mainboard.push(toDeckCard(card, count));
    if (sbCount > 0) sideboard.push(toDeckCard(card, sbCount));
  }

  return {
    title: data.deckName ?? 'Unknown Deck',
    author: data.authorName ?? '',
    url: `https://www.swudb.com/deck/${data.deckId ?? ''}`,
    formatCode: data.deckFormat,
    leaders,
    base: data.base ?? null,
    mainboard,
    sideboard,
  };
}

// 'eternal' is not derivable from leader count — a 1-leader deck is Premier or
// Eternal depending on its card pool (decided in validate.ts with the catalog).
export type DeckFormat = 'premier' | 'eternal' | 'twinSuns';

// Structural detection only: 2 leaders = Twin Suns, else a constructed
// (Premier/Eternal) deck. Returns 'premier' for the constructed case.
export function detectFormat(deck: NormalizedDeck): DeckFormat {
  if (deck.formatCode === 2) return 'twinSuns';
  if (deck.formatCode === 1) return 'premier';
  return deck.leaders.length === 2 ? 'twinSuns' : 'premier';
}
