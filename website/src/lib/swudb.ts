import type { RawDeck, SetInfo } from './types';

// All upstream SWUDB calls go through our same-origin proxy (/api/proxy/*),
// because neither swudb.com nor api.swu-db.com sends CORS headers.
const PROXY_BASE = '/api/proxy';

export class DeckFetchError extends Error {}

export async function fetchDeck(deckId: string): Promise<RawDeck> {
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
