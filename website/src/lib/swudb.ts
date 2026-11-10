import type { RawDeck, SetInfo } from './types';
import { SWUFORGE_PREFIX } from './normalize';
import { forgeExportToRawDeck, parseDeclaredFormat, type ForgeExport } from './swuforge';

// All upstream deck / set calls go through our same-origin proxy
// (/api/proxy/*), because swudb.com, api.swu-db.com and swuforge.com send no
// CORS headers.
const PROXY_BASE = '/api/proxy';

export class DeckFetchError extends Error {}

// `deckKey` comes from normalize.parseDeckUrl: a SWUDB deck id, or
// 'swuforge:{id}' for a SWU Forge deck.
export async function fetchDeck(deckKey: string): Promise<RawDeck> {
  if (deckKey.startsWith(SWUFORGE_PREFIX)) {
    return fetchSwuForgeDeck(deckKey.slice(SWUFORGE_PREFIX.length));
  }
  return fetchSwudbDeck(deckKey);
}

// SWU Forge's export only has set + number ids; card details are filled in
// from the local card database.
async function fetchSwuForgeDeck(deckId: string): Promise<RawDeck> {
  const id = encodeURIComponent(deckId);
  // The export has the cards; the page data only tells us the format
  // (needed to recognize Limited decks), so a failure there is not fatal.
  const [res, declaredFormat] = await Promise.all([
    fetch(`${PROXY_BASE}/swuforge/deck/${id}`),
    fetch(`${PROXY_BASE}/swuforge/deckdata/${id}`)
      .then(async (r) => (r.ok ? parseDeclaredFormat(await r.json()) : null))
      .catch(() => null),
  ]);
  if (res.status === 404) {
    throw new DeckFetchError(
      `SWU Forge deck "${deckId}" not found. Make sure link sharing is on for the deck (private decks can't be read).`,
    );
  }
  if (!res.ok) {
    throw new DeckFetchError(`Failed to load SWU Forge deck "${deckId}" (HTTP ${res.status}).`);
  }
  return forgeExportToRawDeck((await res.json()) as ForgeExport, deckId, declaredFormat);
}

async function fetchSwudbDeck(deckId: string): Promise<RawDeck> {
  const res = await fetch(`${PROXY_BASE}/swudb/deck/${encodeURIComponent(deckId)}`);
  if (res.status === 404) {
    throw new DeckFetchError(
      `Deck "${deckId}" not found. Make sure the deck is Public or Unlisted (Private decks can't be read).`,
    );
  }
  if (!res.ok) {
    throw new DeckFetchError(`Failed to load deck "${deckId}" (HTTP ${res.status}).`);
  }
  return (await res.json()) as RawDeck;
}

let setsCache: SetInfo[] | null = null;

export async function fetchSets(): Promise<SetInfo[]> {
  if (setsCache) return setsCache;
  try {
    const res = await fetch(`${PROXY_BASE}/swudb/sets`);
    if (res.ok) {
      const data = (await res.json()) as SetInfo[];
      if (Array.isArray(data)) {
        setsCache = data;
        return data;
      }
    }
  } catch {
    // fall through to the hardcoded snapshot
  }
  setsCache = FALLBACK_SETS;
  return FALLBACK_SETS;
}

// Snapshot used if the /sets endpoint is unreachable. Only setId / parentSetId /
// releaseDate matter for legality. Names and dates mirror the live
// https://api.swu-db.com/sets response.
const FALLBACK_SETS: SetInfo[] = [
  { setId: 'SOR', fullName: 'Spark of Rebellion', releaseDate: '3/8/24' },
  { setId: 'SHD', fullName: 'Shadows of the Galaxy', releaseDate: '7/12/24' },
  { setId: 'TWI', fullName: 'Twilight of the Republic', releaseDate: '11/8/24' },
  { setId: 'JTL', fullName: 'Jump To Lightspeed', releaseDate: '3/14/25' },
  { setId: 'LOF', fullName: 'Legends of the Force', releaseDate: '7/11/25' },
  { setId: 'IBH', fullName: 'Intro Battle: Hoth', releaseDate: '10/3/25' },
  { setId: 'SEC', fullName: 'Secrets of Power', releaseDate: '11/7/25' },
  { setId: 'LAW', fullName: 'A Lawless Time', releaseDate: '3/27/26' },
  { setId: 'ASH', fullName: 'Ashes of the Empire', releaseDate: '7/27/26' },
  { setId: 'TS26', fullName: 'Twin Suns 2026', releaseDate: '7/11/26' },
];
