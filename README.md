# Star Wars Unlimited Deck Tools

A single-page web app to **sort a deck by set** and **validate a three-deck trilogy** for
[Star Wars: Unlimited](https://starwarsunlimited.com/). It's the website version of the
`sort_deck_by_set.py` and `trilogy_validator.py` scripts in `~/github/swu-tools`.

Paste a [swudb.com](https://swudb.com) deck URL on the left; the sorted list or validation
result renders on the right. All deck logic runs in the browser off a single deck API call.

## Features

- **Sort:** cards grouped/ordered by set, leader + base thumbnails, deck aspect icons, and a
  copy-as-markdown action.
- **Formats:** a constructed deck is classified **Premier** if its whole card pool is from
  Premier-legal sets (set 4+ / JTL onward), otherwise **Eternal** (uses rotated SOR/SHD/TWI or
  TS26 cards). Eternal allows everything but bans IG-2000 (JTL 140) and War Juggernaut (JTL 170).
  Two-leader decks are **Twin Suns**.
- **Validate trilogy:** overall verdict ("Valid for Premier Play"), per-deck summaries with
  aspect icons + card/sideboard counts + a contextual verdict, and an invalid-cards section
  where each cross-deck violation renders as its own card. Trilogy format rules: a trilogy is
  all Twin Suns or all constructed (you can't mix Twin Suns with Premier/Eternal); a constructed
  trilogy is a **Premier Trilogy** only if all three decks are Premier, otherwise an **Eternal
  Trilogy** (Premier decks are allowed alongside Eternal). Combined copy limit: 1 (Twin Suns) / 3
  (Premier / Eternal).
- **Hover preview:** hovering any card row / thumbnail shows the full card art, following the
  cursor.
- Deck 1/2/3 are color-coded (blue/gold/teal) across the trilogy view.

## Stack

- **[Astro](https://astro.build)** static site with a **Svelte** island for the interactive panel
  (`website/src/components/DeckTools.svelte`).
- **Cloudflare Pages** for hosting. The one server-side piece is a small reverse proxy
  (`website/src/pages/api/proxy/[...path].ts`) — needed because the SWUDB APIs send no CORS
  headers, so the browser can't call them directly. It deploys as a Cloudflare Pages Function
  via `@astrojs/cloudflare`.

## How it works

- `GET /api/proxy/swudb/deck/{id}` → `https://www.swudb.com/api/deck/{id}` (whitelisted).
- `GET /api/proxy/swudb/sets` → `https://api.swu-db.com/sets` (set legality catalog).
- Card images load directly from `https://swudb.com/images{defaultImagePath}` (the per-card
  path in the deck payload; no proxy — `<img>` isn't CORS-restricted). Cards without a
  payload path fall back to `https://cdn.swu-db.com/images/cards/{SET}/{NUM}.png` with a
  zero-padded number — note that CDN stores supplemental sets (TS26, IBH) under unpadded
  filenames, so the fallback doesn't work for those.

The deck payload is self-contained (names, sets, numbers, aspects, types), so sorting and
validation need only the single deck call. Logic lives in `website/src/lib/`:

### Local card database

`website/public/data/` holds a pruned per-set card database (`<code>.json` + `index.json`),
exported from the swu-tools cache with `uv run python export_website_data.py` (in
`~/github/swu-tools`). ~936 KB raw across 10 sets, served compressed and lazy-loaded via
`src/lib/carddata.ts`. This keeps the site self-contained except for deck fetches and card
art. The "Supported sets" panel cross-checks each set's local base-card count against the
live catalog and flags missing/stale data with a ⚠.

| File | Responsibility |
|------|----------------|
| `normalize.ts` | Parse deck URL, normalize the API payload, detect format |
| `sort.ts` | Group/sort cards by set (port of `sort_deck_by_set.py`) |
| `validate.ts` | Per-deck Premier / Eternal / Twin Suns + trilogy cross-deck rules |
| `legality.ts` | Set-rotation / pre-release legality, Eternal banlist + constants |
| `cards.ts` | Card identity, image URLs, aspect/alignment helpers |
| `swudb.ts` | Proxy client (`fetchDeck`, `fetchSets`) |

## Local development

Requires Docker. From the repo root:

```bash
docker compose watch
```

Then open <http://localhost:4321>. Edits under `website/src` hot-reload; changing
`package.json` or `astro.config.mjs` rebuilds the image. The proxy runs in-process under the
Astro dev server, so deck/validate work locally with no Cloudflare tooling.

Without Docker:

```bash
cd website && npm install && npm run dev
```

### Logic parity check

`website/test/parity.ts` runs the ported logic against a live deck and prints the sorted +
validation output to eyeball against the Python CLI:

```bash
cd website && npx tsx test/parity.ts <deckId>
```

## Deployment (Cloudflare Pages)

- Build command: `npm run build` — output dir: `dist` — root dir: `website`.
- `@astrojs/cloudflare` emits the proxy as a Pages Function automatically. No env vars/secrets.
- Connect this repo in the Cloudflare Pages dashboard, or `npx wrangler pages deploy dist`.

## Assets & credits

- **Aspect icons** (`website/public/aspects/*.webp`) are vendored from the MIT-licensed
  [SWU-Karabast/forceteki-client](https://github.com/SWU-Karabast/forceteki-client) project and
  hosted locally (not hotlinked). The aspect symbols themselves are Star Wars: Unlimited art,
  © & ™ Lucasfilm Ltd. / Fantasy Flight Publishing — used here for non-commercial fan tooling.
- **Card images** are loaded at runtime from `swudb.com` (falling back to `cdn.swu-db.com`)
  and are likewise official card art.

## Status / roadmap

Logic-first build is complete. Remaining work is tracked in [TODO.md](TODO.md). Highlights deferred:

- **Theming pass** — Star Wars look & feel (see [DESIGN.md](DESIGN.md)).
- TS26 pre-con origin labels and the Premier reprint-by-name allowance (need extra data the
  deck payload doesn't carry — currently flagged as a note rather than auto-passed).
- Non-URL deck sources (JSON / picklist / markdown) that the CLI supports — web app is
  URL-only for now.
