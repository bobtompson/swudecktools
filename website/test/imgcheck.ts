// Ad-hoc check: every card image URL generated for a live deck resolves.
import { normalizeDeck } from '../src/lib/normalize';
import { cardImage } from '../src/lib/cards';

async function main() {
  const id = process.argv[2] ?? 'nwTEaIzdI';
  const raw = await (await fetch(`https://www.swudb.com/api/deck/${id}`)).json();
  const deck = normalizeDeck(raw);
  const urls = new Set<string>();
  for (const l of deck.leaders) urls.add(cardImage(l));
  if (deck.base) urls.add(cardImage(deck.base));
  for (const c of [...deck.mainboard, ...deck.sideboard]) urls.add(cardImage(c.card));
  let bad = 0;
  for (const u of urls) {
    const r = await fetch(u, { method: 'HEAD' });
    if (r.status !== 200) { bad++; console.log(r.status, u); }
  }
  console.log(`deck ${id}: checked ${urls.size} image urls, ${bad} failures`);
  console.log('sample:', [...urls][0]);
}
main();
