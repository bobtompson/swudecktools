import type { SetInfo } from './types';

// Port of constants in lib/swudb.py. Premier-legal sets span both main sets
// (LOF, SEC, LAW, ASH, ...) and sub sets (IBH). Next rotation: JTL rotates
// out when Legacy of Skywalker (set 10, first 2027 set) releases — the plan
// appears to be rotating the oldest Premier-legal set annually.
export const PREMIER_LEGAL_SETS = new Set(['JTL', 'LOF', 'IBH', 'SEC', 'LAW', 'ASH']);
export const PREMIER_ROTATED_SETS = new Set(['SOR', 'SHD', 'TWI']);
export const PREMIER_EXCLUDED_SETS = new Set(['TS26']);
// HMW = "HomeWorlds", the main set after ASH, releasing 10/18/26. IC27 =
// "Icons 2027 Edition", an IBH-like Premier-legal supplemental set releasing
// 11/20/26. Both use overrides below and flip legal at release - 7 days.
export const PREMIER_PENDING_SETS = new Set(['HMW', 'IC27']);
export const PRERELEASE_DAYS = 7;

// Release-date overrides ("M/D/YY") for sets whose swu-db catalog date is
// wrong or missing. ASH released 7/17/26 (catalog says 7/27/26) — display-only
// now that ASH is in PREMIER_LEGAL_SETS. HMW releases 10/18/26
// (announced; not yet in the catalog) -> Premier-legal 10/11/26. IC27 releases
// 11/20/26 (announced; not yet in the catalog) -> Premier-legal 11/13/26. TS26
// released 5/8/26 (catalog says 7/11/26) — display-only, it's Premier-excluded.
export const RELEASE_DATE_OVERRIDES: Record<string, string> = {
  ASH: '7/17/26',
  HMW: '10/18/26',
  IC27: '11/20/26',
  TS26: '5/8/26',
};

export const PREMIER_SUSPENDED_CARDS = new Set([
  'Boba Fett - Collecting the Bounty',
  'Triple Dark Raid',
  'Jango Fett - Concealing the Conspiracy',
  'DJ - Blatant Thief',
  'Force Throw',
]);

// Cards banned in Eternal only (they remain Premier-legal). Matched by card
// name (lowercased) so any printing is caught. JTL 140 / JTL 170.
// https://starwarsunlimited.com/how-to-play?chapter=rules
export const ETERNAL_BANNED_CARDS = new Set(['ig-2000', 'war juggernaut']);

// Display order for sorting output: main numbered sets ("set 1" SOR through
// "set 9" HMW) first, then sub sets (supplemental products, release order),
// then unknown codes.
// 2027 sets teased at Worlds 2026 (codes TBD), in timeline order: Legacy of
// Skywalker (set 10), System Overload, Icons 2028 (a sub set, likely IC28),
// Galaxy at War. Starting with set 10, every main set ships with two Twin Suns
// decks following the TS26 model: the sub set code holds only the new Twin
// Suns-exclusive cards (Premier-excluded); the rest of each deck is reprints
// carrying their own sets' codes.
export const SET_ORDER = ['SOR', 'SHD', 'TWI', 'JTL', 'LOF', 'SEC', 'LAW', 'ASH', 'HMW'];
export const SUB_SET_ORDER = ['IBH', 'TS26', 'IC27'];

interface Legality {
  premier: boolean;
  eternal: boolean;
  twinSuns: boolean;
}

// Parse "M/D/YY" (swu-db format) into a Date, or null.
function parseReleaseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  return new Date(year, month - 1, day);
}

// Port of set_legality. `today` is injectable for deterministic tests.
export function setLegality(
  setId: string,
  catalog: SetInfo[],
  today: Date = new Date(),
): Legality {
  const info = catalog.find((s) => s.setId === setId);
  if (!info) {
    // swu-db's catalog lags on new sets; a pending set with an override date
    // can still flip Premier-legal on schedule.
    if (PREMIER_PENDING_SETS.has(setId) && RELEASE_DATE_OVERRIDES[setId]) {
      const release = parseReleaseDate(RELEASE_DATE_OVERRIDES[setId]);
      if (release) {
        const window = new Date(release);
        window.setDate(window.getDate() - PRERELEASE_DAYS);
        return { premier: today >= window, eternal: true, twinSuns: true };
      }
    }
    return { premier: false, eternal: true, twinSuns: true };
  }

  const effectiveParent = info.parentSetId || setId;
  let premier: boolean;

  if (PREMIER_EXCLUDED_SETS.has(effectiveParent) || PREMIER_ROTATED_SETS.has(effectiveParent)) {
    premier = false;
  } else if (PREMIER_LEGAL_SETS.has(effectiveParent)) {
    premier = true;
  } else if (PREMIER_PENDING_SETS.has(effectiveParent)) {
    const parentInfo = catalog.find((s) => s.setId === effectiveParent) ?? info;
    const release = parseReleaseDate(
      RELEASE_DATE_OVERRIDES[effectiveParent] ?? parentInfo.releaseDate,
    );
    if (release) {
      const window = new Date(release);
      window.setDate(window.getDate() - PRERELEASE_DAYS);
      premier = today >= window;
    } else {
      premier = false;
    }
  } else {
    premier = false;
  }

  return { premier, eternal: true, twinSuns: true };
}

// ---- Status reporting (for the "Supported sets" panel) ----

export interface SetStatus {
  code: string;
  inCatalog: boolean;
  releaseDate: string | null; // "M/D/YY" (override wins over catalog)
  dateOverridden: boolean;
  premierKind: 'legal' | 'pending' | 'rotated' | 'excluded';
  premierFrom: string | null; // "M/D/YY" flip date for pending sets with a known date
  catalogCards: number | null; // numberCards from the catalog (for staleness checks)
}

function formatMDY(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

export function setStatus(code: string, catalog: SetInfo[], today: Date = new Date()): SetStatus {
  const info = catalog.find((s) => s.setId === code);
  const override = RELEASE_DATE_OVERRIDES[code];
  const releaseDate = override ?? info?.releaseDate ?? null;

  let premierKind: SetStatus['premierKind'];
  if (PREMIER_ROTATED_SETS.has(code)) premierKind = 'rotated';
  else if (PREMIER_EXCLUDED_SETS.has(code)) premierKind = 'excluded';
  else if (setLegality(code, catalog, today).premier) premierKind = 'legal';
  else premierKind = 'pending';

  let premierFrom: string | null = null;
  if (premierKind === 'pending' && releaseDate) {
    const release = parseReleaseDate(releaseDate);
    if (release) {
      release.setDate(release.getDate() - PRERELEASE_DAYS);
      premierFrom = formatMDY(release);
    }
  }

  return {
    code,
    inCatalog: info !== undefined,
    releaseDate,
    dateOverridden: override !== undefined,
    premierKind,
    premierFrom,
    catalogCards: info?.numberCards ?? null,
  };
}
