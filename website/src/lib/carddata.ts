// Local card database — pruned per-set JSON exported from swu-tools
// (export_website_data.py) into /public/data/. Makes the site self-contained
// for card data; only deck fetches and card art stay external.

import { PREMIER_LEGAL_SETS } from './legality';

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

// The reprint-rule pool: full card names ("Name - Subtitle", lowercased)
// printed in any Premier-legal set. Port of get_premier_reprint_names in
// swu-tools/validate_deck_format.py — a reprint shares both name and subtitle,
// and any printing of a pooled name is Premier-legal. Resolves to null when no
// local data loads at all (validation then falls back to a verify-manually
// note); sets that fail individually are skipped, like the Python side.
export async function buildPremierReprintNames(): Promise<Set<string> | null> {
  const lists = await Promise.all([...PREMIER_LEGAL_SETS].map((code) => fetchLocalSet(code)));
  const loaded = lists.filter((cards): cards is LocalCard[] => cards !== null);
  if (loaded.length === 0) return null;
  const names = new Set<string>();
  for (const cards of loaded) {
    for (const card of cards) {
      const subtitle = (card.subtitle ?? '').trim();
      names.add((subtitle ? `${card.name} - ${subtitle}` : card.name).toLowerCase());
    }
  }
  return names;
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
