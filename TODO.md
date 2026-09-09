# TODO

Status: logic-first build is complete and working locally (`docker compose watch` → http://localhost:4321).
Sort + Trilogy validator both functional, with Premier / Eternal / Twin Suns format support.

## Big items

- [x] **Theming pass** — done (2026-06). Barlow type, CSS starfield, gold accents, per-set
      logo/color section headers. Details in `DESIGN.md`.
- [x] **Deploy to Cloudflare** — done 2026-06-11, via git-connected **Workers** (not Pages;
      Cloudflare's go-forward platform). Repo `bobtompson/swudecktools`, path `/website`,
      build `npm run build`, deploy `npx wrangler deploy` (config in `website/wrangler.jsonc`;
      `public/.assetsignore` keeps `_worker.js`/`_routes.json` out of the public assets).
      Push to `main` = production deploy; branch pushes upload preview versions.
      Live: <https://swudecktools.bob-tompson.workers.dev>
  - [x] Custom domain live: <https://swu.0xfe.us> (Worker → Settings → Domains & Routes).

## Upcoming sets (Q4 2026 / 2027)

- [ ] **2027 sets teased at Worlds 2026** (codes TBD; 4 sets/year), in timeline order:
      **Legacy of Skywalker** (set 10), **System Overload**, **Icons 2028** (a sub set,
      likely `IC28`), **Galaxy at War**. When codes are announced, follow the HMW
      checklist below (main sets go in `SET_ORDER` / Python `MAIN_SETS`; sub sets like
      Icons go in `SUB_SET_ORDER` / Python `SUB_SETS`).
- [ ] **JTL rotation** — announced at Worlds 2026: JTL rotates out of Premier when
      Legacy of Skywalker releases (first 2027 set). Move `JTL` from
      `PREMIER_LEGAL_SETS` to `PREMIER_ROTATED_SETS` in `legality.ts` and
      `swu-tools/lib/swudb.py`. Expect this annually: oldest Premier-legal set rotates
      with each year's first release. (Also re-check the `ETERNAL_BANNED_CARDS` JTL
      entries still make sense once JTL is Eternal-only in Premier terms.)
- [ ] **Twin Suns companion decks from set 10 on** — every main set release ships with
      two Twin Suns decks, following the TS26 model: the sub set code holds only the
      new Twin Suns-exclusive cards, and the rest of each deck is reprints carrying
      their own sets' codes. So the per-set legality model covers it — when a code is
      announced, add it to `SUB_SET_ORDER` / Python `SUB_SETS` and
      `PREMIER_EXCLUDED_SETS` in both repos, exactly like TS26. (Optionally add a
      `ts26_decks.json`-style origin file for pre-con tagging in the sorter.)

- [ ] **IC27 (Icons 2027 Edition)** — Premier-pending (IBH-like supplemental), releases
      **11/20/26** (in `RELEASE_DATE_OVERRIDES`, `lib/legality.ts` + `swu-tools/lib/swudb.py`;
      flips Premier-legal 11/13/26 even if the swu-db catalog lags). Still to do: add
      logo/color to `lib/sets.ts` + `public/sets/` when the media kit ships them.
- [x] **HMW (Homeworlds)** (main set after ASH) — announced 2026-07, releases **10/9/26**
      (in `RELEASE_DATE_OVERRIDES`, `lib/legality.ts` + `swu-tools/lib/swudb.py`; flips
      Premier-legal 10/2/26 even if the swu-db catalog lags). Added to `SET_ORDER`,
      `PREMIER_PENDING_SETS`, `lib/sets.ts`, and Python `MAIN_SETS` (2026-07-26). Still to
      do: logo/color in `lib/sets.ts` + `public/sets/` when the media kit ships them, and a
      TCGplayer group id in `swu-tools/lib/tcgcsv.py` once TCGplayer lists the set.

## Features / correctness

- [ ] **Set-code validity check** — flag any card whose set code isn't in the official `/sets`
      catalog as invalid in all formats (judges require valid set codes). Today an unknown code
      silently falls through to Eternal. The local card DB (`public/data/`, `lib/carddata.ts`)
      now makes the stronger (SET, NUMBER) existence check possible too.
- [ ] TS26 pre-con origin labels (needs `ts26_decks.json` from the Python tool).
- [ ] Non-URL deck sources (JSON / picklist / markdown) that the CLI supports — web app is
      URL-only for now.
- [x] **Premier reprint rule** — implemented 2026-07-26. (The earlier "moot per design"
      note here was wrong: a reprint gets a new set code, but the *old* printing also stays
      legal until the latest set containing that card rotates out — e.g. SEC 258 Grassroots
      Resistance stays legal via ASH 258 after SEC rotates.) `buildPremierReprintNames()`
      (`carddata.ts`) pools lowercased "Name - Subtitle" from the local data of every
      `PREMIER_LEGAL_SETS` set; `validatePremier` / `classifyDeck` / `validateTrilogy` take
      the pool, silently pass matching non-legal printings, and hard-fail the rest. Without
      local data the old "verify manually" note behavior remains. The Python side had a
      subtitle bug (pool held bare `Name`, deck names are `Name - Subtitle`, so unique-card
      reprints like Chopper Base - Atollon never matched) — fixed in
      `get_premier_reprint_names`. Keep `public/data/` fresh (`export_website_data.py`) —
      the pool is only as current as the export.

## Polish

- [ ] **Add a Star Wars themed background image to the title bar** (site header). Check
      licensing before borrowing art — the official media kit (see `DESIGN.md` assets notes)
      is the safest source.
- [x] **Responsive layout** — done with the theming pass (stacks under 900px; card preview
      hidden on touch devices).
- [ ] Fix the a11y warnings (divs/imgs with mouse handlers need an ARIA `role`) — see dev server
      log lines for `DeckTools.svelte`.
- [x] Card preview polish — fade-in + holographic velocity tilt with glare (2026-06-11).
      ("Larger" still open if 320px feels small.)
- [ ] Optional: per-card aspect icons show every pip; offer a "unique aspects only" view.

## Testing / infra

- [ ] Replace the ad-hoc tsx test scripts (`website/test/*.ts`) with a real runner (vitest) so
      parity + format rules run as `npm test`.
- [ ] `npm audit` triage — fresh Astro install reported a few advisories.
