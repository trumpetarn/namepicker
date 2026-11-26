# Namnväljare

The name picker at [jakobmarkgren.se/namepicker](https://jakobmarkgren.se/namepicker/). It picks a random name from a list with one of four animations (a spinning wheel, a hat, a slot machine or a TV remote), and keeps groups, history, statistics and share links.

It's plain HTML, CSS and JavaScript, with no framework and no build step.

## Suggesting changes

Ideas and bug reports are welcome as [issues](../../issues). To change something yourself:

1. Fork this repo and make a branch.
2. Run it locally and run the checks (below).
3. Open a pull request against `main`.

A merged pull request doesn't go live on its own. The site [jakobmarkgren.se](https://jakobmarkgren.se) includes this repo as a git submodule, and it's published when the site's owner updates the submodule to a new commit.

## Running it locally

```sh
python3 -m http.server 8000     # or: pnpm serve
```

Then open <http://localhost:8000/>. The site menu's links to the site's other pages won't work locally.

## Checks

Install [pnpm](https://pnpm.io) (`corepack enable pnpm` gives you the version pinned in `package.json`), then:

```sh
pnpm install
pnpm check          # lint + type check + tests; CI runs the same on every pull request
```

## A few rules

- Names come from other people's share links and files, so show them with `textContent` or on a canvas, never `innerHTML`.
- Use `randomInt` from `random.js` for anything that decides who wins. `Math.random` is fine for visual effects.
- The site menu, and the site theme block at the top of `index.html`, are the same on every page of jakobmarkgren.se. Leave them as they are; the site's own checks compare them.
- Every top-level file is either part of the page or listed in `.deployignore` (tests check this). Add new tooling files there.

[CLAUDE.md](CLAUDE.md) describes how everything works in more detail.

## License

[MIT](LICENSE). The bundled Comic Neue fonts in `fonts/` are under the [SIL Open Font License](fonts/OFL.txt).
