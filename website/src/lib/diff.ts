import type { NormalizedDeck, DeckCard, RawCard } from './types';
import { cardIdentity, formatCardName } from './cards';

// Port of swu-tools/deck_diff.py: a GitHub-style diff between two decks.
//
// Identity is (set, number) — a card with the same name in a different set
// shows as one removal + one addition (the right behaviour for "what to pull
// from binders"). Each line is the copy-count delta: a card going from 2 to 3
// copies is a single '+ 1x' line, not a remove-all / add-all pair. Removals
// sort before additions; each group keeps (set, number) order.

export type DiffSign = '+' | '-';

export interface DiffLine {
  sign: DiffSign;
  qty: number; // copies to add ('+') or pull ('-')
  oldQty: number;
  newQty: number;
  card: RawCard;
  name: string;
  set: string;
  number: string;
}

export interface DiffSection {
  title: string;
  lines: DiffLine[];
}

export interface DeckDiff {
  oldDeck: NormalizedDeck;
  newDeck: NormalizedDeck;
  sections: DiffSection[]; // only sections with changes, in display order
  added: number; // totals over Leaders/Base/Main/Sideboard (Net isn't counted)
  removed: number;
}

interface Entry {
  qty: number;
  card: RawCard;
}

const keyOf = (card: RawCard): string => cardIdentity(card).join('|');

function sectionMap(cards: DeckCard[]): Map<string, Entry> {
  const out = new Map<string, Entry>();
  for (const c of cards) {
    const key = keyOf(c.card);
    const existing = out.get(key);
    if (existing) existing.qty += c.quantity;
    else out.set(key, { qty: c.quantity, card: c.card });
  }
  return out;
}

function singlesMap(cards: RawCard[]): Map<string, Entry> {
  return new Map(cards.map((card) => [keyOf(card), { qty: 1, card }]));
}

// Python sorts the (set, number) tuples by code point; plain < matches that
// (localeCompare would not, e.g. for digits vs letters in some locales).
const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function diffSection(
  oldMap: Map<string, Entry>,
  newMap: Map<string, Entry>,
): { lines: DiffLine[]; added: number; removed: number } {
  const keys = [...new Set([...oldMap.keys(), ...newMap.keys()])].sort(byCodePoint);
  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  for (const key of keys) {
    const oldQty = oldMap.get(key)?.qty ?? 0;
    const newQty = newMap.get(key)?.qty ?? 0;
    const delta = newQty - oldQty;
    if (delta === 0) continue;
    const card = (newMap.get(key) ?? oldMap.get(key))!.card;
    const [set, number] = cardIdentity(card);
    lines.push({
      sign: delta > 0 ? '+' : '-',
      qty: Math.abs(delta),
      oldQty,
      newQty,
      card,
      name: formatCardName(card),
      set,
      number,
    });
    if (delta > 0) added += delta;
    else removed += -delta;
  }
  // Removals first, then additions; Array.sort is stable, so each group keeps
  // its (set, number) order.
  lines.sort((a, b) => Number(a.sign !== '-') - Number(b.sign !== '-'));
  return { lines, added, removed };
}

export function diffDecks(oldDeck: NormalizedDeck, newDeck: NormalizedDeck): DeckDiff {
  // Web decks always come from the SWUDB API, which keeps the sideboard
  // separate — so (unlike the CLI's file inputs) there's no folding case.
  const pairs: [string, Map<string, Entry>, Map<string, Entry>][] = [
    ['Leaders', singlesMap(oldDeck.leaders), singlesMap(newDeck.leaders)],
    ['Base', singlesMap(oldDeck.base ? [oldDeck.base] : []), singlesMap(newDeck.base ? [newDeck.base] : [])],
    ['Main Deck', sectionMap(oldDeck.mainboard), sectionMap(newDeck.mainboard)],
    ['Sideboard', sectionMap(oldDeck.sideboard), sectionMap(newDeck.sideboard)],
  ];

  const sections: DiffSection[] = [];
  let added = 0;
  let removed = 0;
  for (const [title, oldMap, newMap] of pairs) {
    const d = diffSection(oldMap, newMap);
    if (d.lines.length) sections.push({ title, lines: d.lines });
    added += d.added;
    removed += d.removed;
  }

  if (sections.length) {
    // Physical cards to pull / add with main deck + sideboard combined, so a
    // card that only moves between them (or partly does) nets out.
    const net = diffSection(
      sectionMap([...oldDeck.mainboard, ...oldDeck.sideboard]),
      sectionMap([...newDeck.mainboard, ...newDeck.sideboard]),
    );
    if (net.lines.length) sections.push({ title: 'Net Cards (main + sideboard)', lines: net.lines });
  }

  return { oldDeck, newDeck, sections, added, removed };
}

// '2 → 3' when the card stays in the section, else '' (fully added/removed).
export function countNote(line: DiffLine): string {
  return line.oldQty && line.newQty ? `${line.oldQty} → ${line.newQty}` : '';
}

export function diffLineText(line: DiffLine): string {
  const note = countNote(line);
  return `${line.sign} ${line.qty}x ${line.name} (${line.set} ${line.number})${note ? ` (${note})` : ''}`;
}

// Markdown matching deck_diff.py --markdown: each section in a ```diff fence
// so GitHub / VS Code / most viewers color removals red and additions green.
// The CLI's "Command:" block is left out — there's no command on the web.
export function diffToMarkdown(diff: DeckDiff): string {
  const { oldDeck, newDeck } = diff;
  const out = [
    `# Deck Diff: ${oldDeck.title} → ${newDeck.title}`,
    '',
    `- **old:** ${oldDeck.url}`,
    `- **new:** ${newDeck.url}`,
    '',
  ];
  if (!diff.sections.length) {
    out.push('No changes between decks.');
  } else {
    for (const s of diff.sections) {
      out.push(`## ${s.title}`, '', '```diff', ...s.lines.map(diffLineText), '```', '');
    }
    out.push(`Summary: +${diff.added}, -${diff.removed}`);
  }
  return out.join('\n') + '\n';
}
