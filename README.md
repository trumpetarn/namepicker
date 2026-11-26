# Namepicker

The name picker at [jakobmarkgren.se/namepicker](https://jakobmarkgren.se/namepicker/). It picks a random name from a list with one of four animations (a spinning wheel, a hat, a slot machine or a TV remote), plus a fifth, a Christmas present, in the Christmas theme. It keeps groups of names, a history of picks, statistics and share links, and it can be installed as an app that works offline.

The page itself is in Swedish (its name there is *Namnväljare*). Keep text that users see in Swedish; code, comments and docs are in English.

It's plain HTML, CSS and JavaScript, with no framework and no build step.

## Suggesting changes

Ideas and bug reports are welcome as [issues](https://github.com/trumpetarn/namepicker/issues). To change something yourself:

1. Fork this repo and create a branch.
2. Run the page locally and run the checks (see below).
3. Open a pull request against `main`. The checks run on it automatically; on your first pull request they wait until the owner approves running them.

A merged pull request doesn't go live by itself. The site [jakobmarkgren.se](https://jakobmarkgren.se) includes this repo as a git submodule, and changes go live when the site's owner updates the submodule.

## Where things are

```
index.html            the page, served at jakobmarkgren.se/namepicker/
namepicker.css        all of its styles, with the colour themes at the top
manifest.webmanifest  makes the page installable as an app
sw.js                 service worker: makes the app work offline
js/                   the page's scripts, loaded in the order index.html lists them
  random.js             the random pick that decides who wins
  groups.js             groups of names (the tabs) and saving them
  history.js            the history of picks
  stats.js              statistics over the history
  share.js              share links
  transfer.js           importing and exporting files
  theme.js              the colour themes (dark, light, clown, Christmas)
  effects.js            the winner's spotlight, confetti and sounds
  snow.js               the snow in the Christmas theme
  tunes.js              the Christmas theme's fanfare tunes
  app.js                ties it together: buttons, the draw, start-up
  draws/                the draw animations
    wheel.js              spinning wheel
    hat.js                hat
    slot.js               slot machine
    remote.js             TV remote
    gift.js               Christmas present (only in the Christmas theme)
assets/               icons, fonts and the link preview image
scripts/images.py     draws the icons and the link preview
tests/                tests for the scripts (pnpm test)
```

The rest of the root is configuration for the tools: `package.json`, `eslint.config.js`, `tsconfig/`, `.github/` (CI) and `.deployignore`.

## Setup

You need Node.js 24 (the version CI uses), [pnpm](https://pnpm.io) and Python 3. `corepack enable pnpm` sets up the pnpm version pinned in `package.json`. Corepack comes with Node.js 24 and older; on newer versions, install it first with `npm install -g corepack`. Then:

```sh
pnpm install
```

## Running it locally

```sh
pnpm serve
```

Then open <http://localhost:8000/>. The links in the site menu (top left) go to other pages of jakobmarkgren.se, so they don't work locally.

`pnpm serve` runs Python's built-in web server. Without pnpm, run `python3 -m http.server 8000` instead.

## Checks

```sh
pnpm check          # lint, type check and tests; the same as CI runs on pull requests
```

## Guidelines

- Names come from other people's share links and files, so display them with `textContent` or on a canvas, never with `innerHTML`.
- Use `randomInt` from `js/random.js` for anything that decides who wins. `Math.random` is fine for visual effects.
- The site menu and the site theme block at the top of `index.html` are identical on every page of jakobmarkgren.se, so please don't change them. The checks here only compare the theme colours in `namepicker.css` with that block; the rest is checked when the site picks up your change.
- Every top-level file is either part of the page or listed in `.deployignore`, and the tests check this. Add new tooling files (configs, docs) to `.deployignore`.
- The link preview `assets/og.png` and the app icons in `assets/icons/` are drawn by `scripts/images.py` (needs Python with [Pillow](https://pypi.org/project/pillow/)). A changed image needs a new file name, because they're cached for 30 days.

[CLAUDE.md](CLAUDE.md) describes how everything works in more detail.

## License

[MIT](LICENSE). The bundled Comic Neue fonts in `assets/fonts/` are under the [SIL Open Font License](assets/fonts/OFL.txt).
