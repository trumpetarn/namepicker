# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

The namepicker ("Namnväljare") of [jakobmarkgren.se](https://jakobmarkgren.se), served at `/namepicker/`. It's plain static HTML/CSS/JS with no framework, bundler or build step. It was moved out of the site's repo (`trumpetarn/jakobmarkgren_se`) so friends can open pull requests without access to the rest of the site.

## How it's deployed

- This repo's root **is** the served folder. The site repo includes it as a git submodule at `jakobmarkgren.se/public_html/namepicker`, and the site's deploy rsyncs it with everything else.
- Merging to `main` here deploys nothing. It goes live only when the site repo's submodule is bumped to the new commit (and that reaches the site's `live` branch).
- Every top-level entry that isn't part of the page must be listed in `.deployignore`. The site's deploy leaves those off the server, and its Cloudflare preview's `.assetsignore` repeats the list. `tests/deploy.test.js` fails on a top-level file that's neither linked from `index.html`/`sw.js` nor listed. When adding an entry, the site repo's `.assetsignore` needs it too (the site's tests check that).
- At deploy, the site's `scripts/version-assets.js` rewrites each local CSS/JS link to `?v=<content hash>`, because the host caches static files for 30 days. Commit plain links (`href="namepicker.css"`), never `?v=`. That the service worker also caches the versioned links is tested in the site repo, which owns that script.
- The site menu (top-left `<details class="site-menu">`, its `<style>` and closing `<script>`) and the site theme block (`/* Site theme */` `:root` variables and the first `<script>` in `<head>`) are identical on every page of the site, and the site repo's tests compare them, so don't edit them here. `tests/theme.test.js` checks that `namepicker.css`'s Mörkt and Ljust match the site theme block in `index.html`, so a broken theme fails here and not only when the site bumps the submodule.

## Layout

- The root holds only what has to be there: `index.html` (the page, served at `/namepicker/`), `namepicker.css`, `manifest.webmanifest`, `sw.js` (its scope is its folder), and the tools' config files.
- `js/` holds the page's scripts, with the draw animations in `js/draws/`. `assets/` holds files the page loads that aren't code: `icons/`, `fonts/` and `og.png`.
- `scripts/` holds tools that aren't deployed (`images.py`), `tests/` the node:test suites, and `tsconfig/` the type-check projects.

## Commands

```sh
pnpm install
pnpm serve          # python3 -m http.server 8000; open http://localhost:8000/
pnpm check          # all of the below
pnpm lint           # ESLint (eslint.config.js), incl. inline <script>s in index.html
pnpm typecheck      # tsc --checkJs: tsconfig/app.json (the page), tsconfig/sw.json (the service worker)
pnpm test           # node:test, tests/*.test.js
```

`.github/workflows/checks.yml` runs all three on every PR and on pushes to `main`. The package manager is **pnpm**, pinned in `package.json`'s `packageManager`; `npm install` is refused on purpose (`engines` + `engine-strict` in `.npmrc`).

- **Type check:** the scripts are plain JS checked by `tsc` (TypeScript 7), non-strict. When a DOM lookup's type matters, cast it with JSDoc, e.g. `/** @type {HTMLCanvasElement} */ (document.getElementById('wheel'))`. `sw.js` runs in a worker's global scope, so it's its own project with the webworker lib.
- **Lint:** `no-undef` is off for the page's scripts because they share globals across files; `tsc` catches undefined names instead. Empty `catch {}` blocks are allowed (used on purpose).
- **Tests:** `tests/load-scripts.js` runs the non-module scripts in a `vm` context with shared globals, like the page's `<script>` tags, so plain functions can be tested without a browser.

## Images

`scripts/images.py` (Pillow; not deployed) draws `assets/og.png`, the 1200×630 link preview the page's `og:image` points at (`https://jakobmarkgren.se/namepicker/assets/og.png`), and the app icons in `assets/icons/`. The PNGs are committed. Run `python3 scripts/images.py [--font <ttf>]` after changing the look; the default font is Ubuntu Sans. The host and preview services cache images for 30 days, so give a changed image a new file name and update its references (`og:image`, `manifest.webmanifest`, `sw.js`'s `EXTRA`).

## Architecture

The page follows the site's conventions: dark background, thin white system-font text, uppercase letter-spaced nav, Swedish `lang="sv"` copy, `sv-SE` locale formatting.

`index.html` + `namepicker.css` + plain (non-module) scripts in `js/` that share globals, loaded in this order (the draw animations are in `js/draws/`):

- `random.js` — `randomInt(n)`, an unbiased `crypto.getRandomValues` pick. Use it for anything that decides a draw's outcome; `Math.random` is only for visual effects.
- `theme.js` (colour modes), `effects.js` (spotlight, confetti, sounds), `tunes.js` (Jul's fanfare tunes), `snow.js` (Jul's snow), `groups.js` (state, tabs, `MODES`/`MODE_NAMES`), `history.js`, `stats.js`, `share.js`, `transfer.js` (file import/export), `wheel.js`, `hat.js`, `slot.js` (reel + lever), `remote.js`, `gift.js`; the last five in `js/draws/`.
- `app.js` last — mode switching, the draw, event wiring, init.

`sw.js` (service worker) and `manifest.webmanifest` aren't page scripts and stay at the root (`sw.js` must, because a service worker's scope is its own folder); see **Installable and offline (PWA)** below.

**Draws.** The winner is chosen first, then one of four animations is steered to land on it: a canvas spinning wheel (`Lyckohjulet`), a hat draw (`Hatten`), a looping slot-machine reel (`Enarmade banditen`), or a canvas TV remote that spins in a still ring of names and stops pointing at the winner (`Fjärrkontrollen`). In Jul there's a fifth, a present whose lid pops off and a gift tag with the name rises out (`Julklappen`, `gift.js`).
- **Seasonal methods:** `SEASONAL_MODES` in `groups.js` ties a method to a colour mode (`gift` to `christmas`). `availableModes()` leaves it out elsewhere, so it's hidden from the method row (CSS hides its button too, before scripts run), `Metoder` and `Slumpa`; the history and statistics still name it, and the group keeps whether it's on (`modesSetting`). A colour-mode change re-applies the methods, after the draw if one is running.
- The mode buttons use short labels (`Hjulet`, `Hatten`, `Banditen`, `Fjärren`, `Klappen`) because the full names don't fit on one row; the full names are in their `title`, in `Metoder` and in the history. The row wraps on very narrow screens, and `main` is a size container, so the row, the group actions and the history adapt via `@container` queries.
- `Slumpa`, next to the mode buttons, picks one of them at random: a highlight runs over the buttons and stops on the pick, which becomes the selected mode. It doesn't start a draw.
- Besides the button, a draw starts by clicking or flick-dragging the wheel or the remote (the flick sets direction, turns and speed, but the winner is still pre-chosen; both use `addSpinDrag` in `wheel.js`), clicking the hat, or clicking/dragging the slot machine's lever.
- Every draw ends with a full-screen spotlight of the winner's name (`showSpotlight` in `effects.js`; fades after 4 s or on click/key press, and the name stays in `#result`), canvas confetti and a Web Audio fanfare. The spotlight shrinks a long name until each word fits (`fitSpotlightName`) rather than splitting words.

**Groups and history.** Names are organised in named groups shown as tabs. Each group has:
- its own name list;
- its own enabled methods: the `Metoder` button opens checkboxes, stored as `group.modes` (absent = all). Disabled methods are hidden from the row and skipped by `Slumpa`, and at least one stays on;
- its own history: every pick, each with the method used (`mode`; an imported method that isn't one of ours is kept as free text in `entry.method`). There's no cap; the list shows the newest 25 until `Visa alla`.
- An entry can be **excluded** (`excluded: true`) — a test spin, a redraw, a mistake: the `×` on its row toggles it (shown struck through and faded), and for 10 s after a draw an `Ångra` button under the result excludes that pick (`offerUndo` in `history.js`). A draw that lands less than a minute after the previous pick in the same group excludes that previous pick automatically, as a redraw (`excludeIfRedraw`, `REDRAW_MS`); its `↺` brings it back. Excluded entries stay in the list and the group file, but `includedEntries()` leaves them out of the CSV export and should be used for anything that counts picks, such as the statistics.
- `Statistik` by the history heading swaps the list for statistics of the active group (`stats.js`): picks per person (people in the name list who were never picked show 0) and per method as bar tables, and a method-per-person table where the 4 most used methods get a column and the rest share `Övriga`, for a period (`Allt`, `I år`, last 3 months, last 30 days; undated entries only count under `Allt`). `computeStats` is a pure function over `includedEntries`. The bars use `--series-1`, set per theme and checked for contrast against each theme's `--bg`; the bars are table rows, so the numbers are also there for screen readers.

**Files and sharing.**
- *Exportera CSV* exports the active group's history as semicolon-separated, BOM-prefixed CSV (for Swedish Excel).
- The `Fil` panel (and `Importera` by the history) reads that CSV back into the active group — merge (drops same name + method + minute duplicates) or replace. Only the export's own format is accepted (`historyFromCsv` in `transfer.js`: UTF-8, semicolons, the exact header row, `YYYY-MM-DD` + `HH:MM`); any other file, or any bad row, rejects the whole import with a message naming the row rather than importing part of it.
- `Fil` also exports the whole group (names, `modes`, history) as versioned JSON (`format: 'namnvaljare-grupp'`, `version: 1`); importing one always creates a new group.
- The share button produces a link carrying the group's name and names base64url-encoded in the URL fragment (`#dela=…`), which the page imports on load after confirmation.
- Names can come from other people's share links and files, so render them with `textContent`/canvas, never `innerHTML`.

**Themes.** Four colour modes — `Mörkt`, `Ljust`, `Clown` and `Jul` — are picked top-right. `Mörkt` and `Ljust` are the site theme: the switch saves `site-theme` like the site menu does. `Clown` and `Jul` are the namepicker's own (`OWN_THEMES` in `theme.js`): `data-clown` or `data-christmas` on `<html>` (`localStorage` `namepicker-clown` / `namepicker-christmas`), on top of the site theme, and at most one at a time. Other pages ignore them, and picking anything in the site menu's Tema leaves them. A small inline `<head>` script, before the site theme script, applies them before render and migrates the old `namepicker-theme` key once. `theme.js` watches the attributes with a `MutationObserver`, so any change, wherever it comes from, updates the switch and redraws the canvases. A new own mode needs an `OWN_THEMES` entry, a button, a `:root[data-…]` block and a line in the `<head>` script; `tests/theme.test.js` checks all four.
- Page colours in `namepicker.css` are CSS variables (`--bg`, `--fg`, `--surface`, `--border`, `--muted`, …) defined per theme at the top. Use those rather than hex values for page chrome; objects like the hat slips, lever and remote body keep fixed colours.
- The canvases read the variables via `themeColors` from `theme.js`, and a theme change calls `refreshStage()`.
- The default and light themes' site variables must equal the site theme block's two modes, and each theme also sets the site variables the menu uses (`--rule`, `--secondary`, `--bright`), so the site menu follows the colour mode.
- Clown mode adds polka dots, a rainbow title/spotlight, Comic Sans (falling back to the bundled Comic Neue in `assets/fonts/`, SIL OFL, for devices without it) and a horn after the fanfare.
- Jul is a winter night (dark blue, gold title, red button) with snow falling behind the page: `js/snow.js` draws it on `#snow-canvas` while `data-christmas` is set, watching the attribute itself, and keeps the flakes still with `prefers-reduced-motion`. The wheel, the remote's dots and the confetti use `CHRISTMAS_COLORS` (`sliceColors()` in `wheel.js`, light enough for the dark names). Hatten is a Santa hat (the `#hat` SVG has both hats; CSS shows `.hat-top` or `.hat-santa`). The wheel gets a fir wreath with berries and a bow (`drawWreath`; the slices shrink to `0.86 c` for it) and a gold star as its pointer (CSS on `#wheel-pointer`). The slot machine gets snow on top, frost in the window, a candy-cane lever with a bauble, and fairy lights that twinkle, chase during a draw (`main.drawing`) and glow gold after a win (`main.just-won`, set by `land`). The remote wears a small Santa hat (`drawRemoteSantaHat`, kept short of the ring of names), and the fanfare is a random Christmas tune on bells, with sleigh bells (`playChristmasFanfare` in `effects.js`). The tunes are in `tunes.js`: public-domain, in C major (they share the closing chord), one `pitch:length` line each, picked at random but never the same twice in a row. `tests/tunes.test.js` checks that each parses, ends on a note of the C major chord and lasts at most 7 s (it may go on a little after the 4 s spotlight). Play them at their real tempo: `unit` is seconds per length unit (Nu är det jul igen: eighths at 110 quarter notes a minute).
- **Jul is the default in December.** The `<head>` script turns it on in December unless `namepicker-christmas` is `off-<this year>`. `setOwnTheme` in `theme.js` saves that when another mode is picked in December, so the choice lasts for the rest of that December only; picking Jul in December saves nothing, so it ends with December. Outside December, Jul is saved as `1` like Clown. `tests/theme.test.js` runs the `<head>` script and `theme.js` with fixed dates.

**Installable and offline (PWA).** `manifest.webmanifest` (scope and start URL `/namepicker/`, standalone, dark theme colours) and the icons in `assets/icons/` (180 px apple-touch-icon, 192/512 px for the manifest, drawn by `scripts/images.py` and kept inside the maskable safe zone) make the page installable. `app.js` registers `sw.js`, whose scope is only `/namepicker/`:
- No version is written in `sw.js`. It reads the page's CSS/JS links out of `index.html`, with whatever `?v=` the deploy gave them, and caches exactly those plus its `EXTRA` list (manifest, icons, fonts). When a new file is needed offline and isn't linked from the HTML, add it to `EXTRA`.
- The page is fetched **network first**, so a new deploy shows on the next visit with a connection. The cached copy is used offline, or after `NETWORK_WAIT_MS` (4 s) on a bad connection. Each fresh page also caches its new `?v=` assets and drops the old ones. Versioned assets come from the cache first. Unversioned ones (the preview, a local server) come from the network first.
- `register('sw.js', { updateViaCache: 'none' })` makes browsers check `sw.js` itself on every visit, despite the host's 30-day cache, which `.htaccess` can't change.
- **Kill switch:** if the worker ever caches something wrong, set `KILL = true` at the top of `sw.js` and deploy. On the next visit it deletes its caches, unregisters itself and reloads the tab from the network.
- `sw.js` runs in a worker, not the page, so it has its own type-check project (`tsconfig/sw.json`, webworker lib) and ESLint's service-worker globals. `tests/pwa.test.js` checks the manifest and icons, and that the worker caches every link as committed; the site repo checks it does after `version-assets.js` too.

**`localStorage` keys.**
- `namepicker-groups` — all groups + the active group.
- `namepicker-mode`, `namepicker-clown`, `namepicker-christmas` (`1`, or `off-<year>` after leaving the December default; the old `namepicker-theme` is migrated: `clown` → `namepicker-clown`, `dark`/`light` → the site's `site-theme`).
- `namepicker-names-hidden` — collapsed name list, which enlarges the wheel/hat.
- `namepicker-history-hidden` — history collapsed to its heading, which then shows the count.
- The legacy `namepicker-names`/`namepicker-history` keys are only read once, to migrate into a "Min grupp" group.

