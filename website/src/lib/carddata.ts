// Local card database — pruned per-set JSON exported from swu-tools
// (export_website_data.py) into /public/data/. Makes the site self-contained
// for card data; only deck fetches and card art stay external.

export interface LocalCard {
  number: string;
  name: string;
  type: string;
  subtitle?: string;
  aspects?: string[];
  rarity?: string;
  unique?: boolean;
  cost?: string;
  variant?: string; // absent = base ("Normal") printing
}

export interface LocalDataIndex {
  generated: string; // ISO date the export ran
  sets: Record<string, { cards: number; base: number }>;
}

let indexCache: LocalDataIndex | null = null;
const setCache = new Map<string, LocalCard[]>();

// Resolves to null when the index is missing (data not exported yet).
export async function fetchLocalIndex(): Promise<LocalDataIndex | null> {
  if (indexCache) return indexCache;
  try {
    const res = await fetch('/data/index.json');
    if (!res.ok) return null;
    indexCache = (await res.json()) as LocalDataIndex;
    return indexCache;
  } catch {
    return null;
  }
}

// Resolves to null when the set has no local data file.
export async function fetchLocalSet(code: string): Promise<LocalCard[] | null> {
  const key = code.toLowerCase();
  const cached = setCache.get(key);
  if (cached) return cached;
  try {
    const res = await fetch(`/data/${key}.json`);
    if (!res.ok) return null;
    const cards = (await res.json()) as LocalCard[];
    setCache.set(key, cards);
    return cards;
  } catch {
    return null;
  }
}
