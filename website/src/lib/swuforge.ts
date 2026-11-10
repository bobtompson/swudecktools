// SWU Forge (swuforge.com) deck loader. Port of swu-tools/lib/swuforge.py.
//
// SWU Forge serves each shared deck as the standard SWU deck-export JSON at
// /api/decks/{id}/export — set + number ids and counts only:
//
//   { metadata: { name, author }, leader: { id: 'ASH_009', count: 1 },
//     secondleader: {...} (Twin Suns only), base: {...},
//     deck: [{ id: 'ASH_108', count: 2 }, ...], sideboard: [...] }
//
// exportToRawDeck fills in each card's name, subtitle, type and aspects from
// the local card database (/data/<set>.json) and returns the same RawDeck
// shape the SWUDB deck API gives us, so sort / validate / diff work unchanged.

import type { RawCard, RawDeck, RawDeckEntry } from './types';
import { fetchLocalSet, type LocalCard } from './carddata';
import { padNumber } from './cards';

export interface ForgeItem {
  id?: string;
  count?: number;
}

export interface ForgeExport {
  metadata?: {
    name?: string;
    author?: string;
    swuforgeDeckId?: string;
    swuforgeDeckUrl?: string;
  };
  leader?: ForgeItem | null;
  secondleader?: ForgeItem | null;
  base?: ForgeItem | null;
  deck?: ForgeItem[];
  sideboard?: ForgeItem[];
}

// SWUDB's numeric ids, so a converted deck matches a real SWUDB payload.
const ASPECT_IDS: Record<string, number> = {
  Aggression: 1,
  Command: 2,
  Cunning: 3,
  Vigilance: 4,
  Heroism: 5,
  Villainy: 6,
};
const TYPE_IDS: Record<string, number> = { Leader: 0, Base: 1, Unit: 2, Event: 3, Upgrade: 4 };

// Cards whose text raises the per-deck copy limit. The local data is pruned of
// rules text, so these are listed by name ("A deck can have up to 15 copies").
const COPY_LIMITS: Record<string, number> = { 'Swarming Vulture Droid': 15 };

// swudb.com serves TS26 images under inconsistent filenames, so those cards
// carry no image path and fall back to cdn.swu-db.com (see cards.ts).
const NO_IMAGE_PATH_SETS = new Set(['TS26']);

type Lookup = (set: string, number: string) => LocalCard | undefined;

function splitId(id: string): [string, string] {
  const i = id.indexOf('_');
  if (i < 0) return [id.toUpperCase(), ''];
  return [id.slice(0, i).toUpperCase(), padNumber(id.slice(i + 1))];
}

// SWUDB-style card for a SWU Forge card id like 'ASH_108'. Unknown cards (set
// not in the local data, number missing) become a stub named '[ASH_108]' so
// the deck still loads and the gap is visible.
function toRawCard(id: string, lookup: Lookup): RawCard {
  const [set, number] = splitId(id);
  const local = lookup(set, number);
  const aspects = (local?.aspects ?? []).map((a) => ASPECT_IDS[a]).filter((a) => a !== undefined);
  const cost = local?.cost === undefined || local.cost === '' ? NaN : Number(local.cost);
  return {
    cardId: undefined,
    cardName: local?.name ?? `[${id}]`,
    title: local?.subtitle ?? '',
    cost: Number.isFinite(cost) ? cost : null,
    aspects,
    frontsideAspects: aspects,
    type: local ? (TYPE_IDS[local.type] ?? null) : null,
    alternativeDeckMaximum: local ? (COPY_LIMITS[local.name] ?? null) : null,
    defaultImagePath: NO_IMAGE_PATH_SETS.has(set) ? undefined : `/cards/${set}/${number}.png`,
    defaultExpansionAbbreviation: set,
    defaultCardNumber: number,
  };
}

// SWU Forge format slugs -> our DeckFormat names.
const FORMAT_NAMES: Record<string, string> = {
  premier: 'premier',
  eternal: 'eternal',
  'twin-suns': 'twinSuns',
  limited: 'limited',
};

// The format the deck's owner picked on SWU Forge, or null if it can't be
// read. The export has no format field, so this reads the deck page's data
// file — SvelteKit's flattened ("devalue") encoding: a list where each
// object's values are indexes back into the same list. Best effort: any
// unexpected shape returns null and the format is inferred instead.
export function parseDeclaredFormat(pageData: unknown): string | null {
  try {
    const nodes = (pageData as { nodes?: { data?: unknown }[] }).nodes ?? [];
    for (const node of nodes) {
      const data = node?.data;
      if (!Array.isArray(data) || typeof data[0] !== 'object' || data[0] === null) continue;
      const root = data[0] as Record<string, number>;
      if (!('deck' in root)) continue;
      const deck = data[root.deck] as Record<string, number>;
      const slug = data[deck.format];
      return typeof slug === 'string' ? (FORMAT_NAMES[slug] ?? null) : null;
    }
  } catch {
    // fall through
  }
  return null;
}

// Pure conversion (no network) so it can be tested against fixture data.
export function exportToRawDeck(
  data: ForgeExport,
  lookup: Lookup,
  fallbackId = '',
  declaredFormat: string | null = null,
): RawDeck {
  const single = (item: ForgeItem | null | undefined): RawCard | null =>
    item?.id ? toRawCard(item.id, lookup) : null;

  // One entry per printing, with main-deck and sideboard counts side by side.
  const entries = new Map<string, Required<RawDeckEntry>>();
  const add = (items: ForgeItem[] | undefined, field: 'count' | 'sideboardCount') => {
    for (const item of items ?? []) {
      const count = item?.count ?? 0;
      if (!item?.id || count <= 0) continue;
      let entry = entries.get(item.id);
      if (!entry) {
        entry = { card: toRawCard(item.id, lookup), count: 0, sideboardCount: 0 };
        entries.set(item.id, entry);
      }
      entry[field] += count;
    }
  };
  add(data.deck, 'count');
  add(data.sideboard, 'sideboardCount');

  const secondLeader = single(data.secondleader);
  const deckId = data.metadata?.swuforgeDeckId ?? fallbackId;
  return {
    deckId,
    deckUrl: data.metadata?.swuforgeDeckUrl ?? `https://swuforge.com/decks/${deckId}`,
    deckName: data.metadata?.name,
    authorName: data.metadata?.author,
    // The export has no format field: two leaders means Twin Suns.
    deckFormat: secondLeader ? 2 : 1,
    declaredFormat,
    leader: single(data.leader),
    secondLeader,
    base: single(data.base),
    shuffledDeck: [...entries.values()],
  };
}

// Every set code a deck export references.
export function exportSetCodes(data: ForgeExport): string[] {
  const ids = [data.leader, data.secondleader, data.base, ...(data.deck ?? []), ...(data.sideboard ?? [])]
    .map((item) => item?.id)
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids.map((id) => splitId(id)[0]))];
}

// Loads the local card data for the sets a deck uses and converts the export.
export async function forgeExportToRawDeck(
  data: ForgeExport,
  fallbackId = '',
  declaredFormat: string | null = null,
): Promise<RawDeck> {
  const bySet = new Map<string, Map<string, LocalCard>>();
  await Promise.all(
    exportSetCodes(data).map(async (set) => {
      const cards = await fetchLocalSet(set);
      if (!cards) return;
      const byNumber = new Map<string, LocalCard>();
      for (const card of cards) byNumber.set(padNumber(card.number), card);
      bySet.set(set, byNumber);
    }),
  );
  return exportToRawDeck(data, (set, number) => bySet.get(set)?.get(number), fallbackId, declaredFormat);
}
