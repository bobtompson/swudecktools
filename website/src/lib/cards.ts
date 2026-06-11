import type { RawCard } from './types';

// Card images are served (CORS-free for <img>) at a predictable path derived
// from the set abbreviation and 3-digit card number. Caveat: cdn.swu-db.com
// stores supplemental sets (TS26, IBH) under UNPADDED filenames (20.png, not
// 020.png), so this padded construction 403s for them — it's only the fallback
// when the deck payload carries no defaultImagePath.
export function cardImageUrl(set: string, number: string): string {
  return `https://cdn.swu-db.com/images/cards/${set.toUpperCase()}/${padNumber(number)}.png`;
}

// swudb.com serves every printing at /images + defaultImagePath. The payload
// sometimes prefixes the path with "~" (swudb's own frontend strips it too).
export function swudbImageUrl(imagePath: string | null | undefined): string | null {
  const path = (imagePath ?? '').replace(/~/g, '').trim();
  return path ? `https://swudb.com/images${path}` : null;
}

// Preferred image source for a card from the deck payload.
export function cardImage(card: RawCard): string {
  return (
    swudbImageUrl(card.defaultImagePath) ??
    cardImageUrl(card.defaultExpansionAbbreviation ?? '', String(card.defaultCardNumber ?? ''))
  );
}

export function padNumber(n: string | number): string {
  const s = String(n ?? '').trim();
  return s === '' ? '' : s.padStart(3, '0');
}

// (SET, NNN) identity used to match a card across decks/printings.
// Port of lib/deck_source.card_identity.
export function cardIdentity(card: RawCard): [string, string] {
  const set = (card.defaultExpansionAbbreviation ?? '').toUpperCase();
  const num = padNumber(card.defaultCardNumber ?? '');
  return [set, num];
}

// Port of validate_deck_format.format_card_name: "Name - Title" when titled.
export function formatCardName(card: RawCard): string {
  const name = card.cardName ?? '';
  const title = (card.title ?? '').trim();
  return title ? `${name} - ${title}` : name;
}

// Aspect ids used for Twin Suns leader-alignment checks.
export const HEROISM_ASPECT_ID = 5;
export const VILLAINY_ASPECT_ID = 6;

// Returns 'Heroism' | 'Villainy' | null from a card's front-side aspects.
export function extractAlignment(card: RawCard): 'Heroism' | 'Villainy' | null {
  const front = card.frontsideAspects ?? [];
  if (front.includes(HEROISM_ASPECT_ID)) return 'Heroism';
  if (front.includes(VILLAINY_ASPECT_ID)) return 'Villainy';
  return null;
}
