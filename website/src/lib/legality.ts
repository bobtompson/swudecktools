import type { SetInfo } from './types';

// Port of constants in lib/swudb.py. Premier-legal sets span both main sets
// (LOF, SEC, LAW, ASH, ...) and sub sets (IBH). Sets rotate a whole block at a
// time — the block is the letter in the rotation symbol printed at the bottom
// of each card: none = SOR/SHD/TWI (rotated), A = JTL/LOF/SEC, B =
// IBH/LAW/ASH/HMW/IC27. Next rotation: block A rotates out when Legacy of
// Skywalker (set 10, first 2027 set) releases.
export const PREMIER_LEGAL_SETS = new Set(['JTL', 'LOF', 'IBH', 'SEC', 'LAW', 'ASH', 'HMW']);
export const PREMIER_ROTATED_SETS = new Set(['SOR', 'SHD', 'TWI']);
export const PREMIER_EXCLUDED_SETS = new Set(['TS26']);
// IC27 = "Icons 2027 Edition", an IBH-like Premier-legal supplemental set
// releasing 11/21/26. (HMW released 10/9/26 and moved to PREMIER_LEGAL_SETS.) Pending sets flip legal at release - 7 days, unless
// PREMIER_LEGAL_DATE_OVERRIDES gives an explicit date.
export const PREMIER_PENDING_SETS = new Set(['IC27']);
export const PRERELEASE_DAYS = 7;

// Release-date overrides ("M/D/YY") for sets whose swu-db catalog date is
// wrong or missing. ASH released 7/17/26 (catalog says 7/27/26) — display-only
// now that ASH is in PREMIER_LEGAL_SETS. HMW releases 10/9/26
// (announced; not yet in the catalog) -> Premier-legal 10/2/26. IC27 releases
// 11/21/26 (Premier date: see below). TS26
// released 5/8/26 (catalog says 7/11/26) — display-only, it's Premier-excluded.
export const RELEASE_DATE_OVERRIDES: Record<string, string> = {
  ASH: '7/17/26',
  HMW: '10/9/26',
  IC27: '11/21/26',
  TS26: '5/8/26',
};

// Explicit Premier-legal dates ("M/D/YY") for pending sets that don't follow
// the release - PRERELEASE_DAYS rule. IC27 releases 11/21/26 but is only
// Premier-legal from 11/27/26 (no pre-release window for Icons).
export const PREMIER_LEGAL_DATE_OVERRIDES: Record<string, string> = {
  IC27: '11/27/26',
};

// Bases whose text changes the minimum deck size (card name -> cards added to
// the format minimum: 50 for Premier / Eternal, 80 for Twin Suns). Both are
// JTL: Thermal Oscillator (025) "decreased by 5", Data Vault (024) "increased
// by 10". There is no maximum deck size.
export const BASE_MIN_DECK_SIZE_MODIFIERS: Record<string, number> = {
  'Thermal Oscillator': -5,
  'Data Vault': 10,
};

// Card-name suspensions in Premier ("Name - Subtitle" for uniques), checked
// against leaders and bases as well as the main deck and sideboard. The older
// SOR/SHD/TWI suspensions were dropped once those sets rotated out.
export const PREMIER_SUSPENDED_CARDS = new Set([
  // Suspended 8/2026 — the ASH 011 leader (other Cad Bane printings are legal).
  'Cad Bane - Still Faster Than You',
  // Suspended 11/9/26 (Premier Format Update: November 2026).
  'Chimaera - A Frightening Reality', // ASH 052
  'Koska Reeves - Warrior of Mandalore', // ASH 079
  'Neel - The Cutest Boy', // ASH 248
  'Aggressive Negotiations', // SEC 179
]);

// Cards banned in Eternal only, matched by card name (lowercased) so any
// printing is caught. Currently empty: IG-2000 and War Juggernaut were
// unbanned and Eternal has no suspensions.
export const ETERNAL_BANNED_CARDS = new Set<string>();

// True when a card (full "Name - Subtitle") is on a format's own suspension
// list. Premier's list is by full name, Eternal's by base card name (any
// printing); Twin Suns has none.
export function isSuspendedIn(
  format: 'premier' | 'eternal' | 'twinSuns' | null | undefined,
  fullName: string,
): boolean {
  if (format === 'premier') return PREMIER_SUSPENDED_CARDS.has(fullName);
  if (format === 'eternal') {
    const lower = fullName.trim().toLowerCase();
    return ETERNAL_BANNED_CARDS.has(lower) || ETERNAL_BANNED_CARDS.has(lower.split(' - ')[0]);
  }
  return false;
}

// Where a card is suspended, for the "Suspended" stamp shown on a deck of the
// given format: 'Premier', 'Eternal', 'Premier · Eternal', or '' for none.
// One-leader decks are Premier or Eternal depending on their card pool — a
// Premier-suspended card is exactly what makes an otherwise Premier deck
// Eternal — so they show both lists. Twin Suns (and unclassified) decks show
// nothing: no suspension list applies there.
export function suspendedWhere(
  deckFormat: 'premier' | 'eternal' | 'twinSuns' | null | undefined,
  fullName: string,
): string {
  if (deckFormat !== 'premier' && deckFormat !== 'eternal') return '';
  const where: string[] = [];
  if (isSuspendedIn('premier', fullName)) where.push('Premier');
  if (isSuspendedIn('eternal', fullName)) where.push('Eternal');
  return where.join(' · ');
}

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

// Port of premier_legal_date: the date a pending set becomes Premier-legal,
// or null if unknown. The explicit override wins; otherwise release date
// (override, then catalog) minus PRERELEASE_DAYS.
export function premierLegalDate(setId: string, catalogRelease?: string): Date | null {
  const explicit = parseReleaseDate(PREMIER_LEGAL_DATE_OVERRIDES[setId]);
  if (explicit) return explicit;
  const release = parseReleaseDate(RELEASE_DATE_OVERRIDES[setId] ?? catalogRelease);
  if (!release) return null;
  release.setDate(release.getDate() - PRERELEASE_DAYS);
  return release;
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
    if (PREMIER_PENDING_SETS.has(setId)) {
      const legalFrom = premierLegalDate(setId);
      if (legalFrom) return { premier: today >= legalFrom, eternal: true, twinSuns: true };
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
    const legalFrom = premierLegalDate(effectiveParent, parentInfo.releaseDate);
    premier = legalFrom !== null && today >= legalFrom;
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
  released: boolean; // releaseDate is known and today is on/after it
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
  if (premierKind === 'pending') {
    const legalFrom = premierLegalDate(code, info?.releaseDate);
    if (legalFrom) premierFrom = formatMDY(legalFrom);
  }

  const release = parseReleaseDate(releaseDate ?? undefined);

  return {
    code,
    inCatalog: info !== undefined,
    releaseDate,
    dateOverridden: override !== undefined,
    released: release !== null && today >= release,
    premierKind,
    premierFrom,
    catalogCards: info?.numberCards ?? null,
  };
}
