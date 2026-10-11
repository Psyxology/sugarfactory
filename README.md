# Retro Quest Arcade

A small website where you can play short sessions of classic 2000s-era PC games right in your web browser. Nobody needs to download or supply any game files; everything the games need is included here, and it all works on phones too where the game allows.

## What's in the arcade

| Folder | Game | Notes |
| --- | --- | --- |
| `diablo/` | Diablo | Runs the free shareware demo (`spawn.mpq`). Engine: [diablo_web](https://github.com/JohnImril/diablo_web), built for this site. |
| `tower-defense/` | Kingdom's Last Stand | An original tower defense game made for this arcade. Plain HTML and JavaScript, no build step. |
| `quake3/` | Quake III Arena | The free 1999 demo, played against bots. Engine: [ioquake3](https://github.com/ioquake/ioq3) built for the browser. See `quake3/SOURCE.txt`. |
| (landing page) | Diablo II | Shown as "coming soon". |

`index.html` at the top is the landing page with a card for each game.

## Licenses

- The Quake III demo data (`quake3/demoq3/pak0.pk3`) is id Software's free demo, shared for free, non-commercial use only. Its license, `quake3/DEMO-LICENSE.txt`, must always stay alongside it.
- ioquake3 is GPL v2; our one small change is in `quake3/ioquake3-changes.patch`.
- The Diablo shareware demo data (`diablo/spawn.mpq`) was freely distributed by Blizzard as shareware.

## Running it on your own computer

The games only work when the site is served by a web server; double-clicking `index.html` will not work. The easiest way, if you have Python installed:

1. Open a terminal in this folder.
2. Run `python3 -m http.server 8000`
3. Open http://localhost:8000 in your browser.

## Putting it online

Any static web host can serve this folder as-is (for example GitHub Pages, Netlify, or Cloudflare Pages). No server code is needed.
