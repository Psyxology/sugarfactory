# Arena Royale

A small single-player battle royale that runs in the browser: you against 5 to 11 bots on
OpenArena's tropical island map (islanddm). Nobody respawns, a blue wall closes in on a random
spot, and the last one standing wins. A match takes about 2 to 3 minutes.

Players never need to supply any files. Everything is in this folder (about 54 MB).

## Running it

Serve this folder from any web server and open `index.html` (browsers refuse to run it from a
`file://` link). For a quick local test: `python3 -m http.server` in this folder, then open
http://localhost:8000/. It needs a keyboard and mouse.

## What's inside

| File | What it is |
|---|---|
| `index.html` | Start screen, download progress, bot count and skill pickers, launches the game |
| `ioquake3.js`, `ioquake3.wasm` | ioquake3 engine compiled to WebAssembly |
| `ioquake3-config.json` | List of game files the page downloads |
| `baseoa/pak0-royale.pk3` | Trimmed OpenArena 0.8.8 content: the island map, 12 bot characters, weapons, sounds |
| `baseoa/zz-royale.pk3` | The battle royale game code (QVMs) plus the zone wall texture |
| `source/` | Source changes (see Licenses) |

## How the rules work

- 12 seconds of safe looting at the start (no one can be hurt), then "GO!"
- Everyone starts with a gauntlet and a machinegun with 20 bullets. Extra weapons are scattered
  over the island; weapons don't respawn, health and ammo come back slowly.
- The zone shrinks in steps and fully closes after about 3 minutes. Outside it you take damage
  every second, more as the zone gets smaller. Bots head back into the zone, even mid-fight.
- When you're knocked out you see your placement, then watch the remaining players.
  Click to start a new match at any time after that, or after the match is decided.

## Licenses and credits

- Engine: [ioquake3](https://github.com/ioquake/ioq3) (GPL v2), built from commit
  83a776283bdb958f82db25554b5ed0966aaf6e49 with `source/ioquake3-web.patch`
  (512 MB memory, and a hook so the page can send console commands).
- Game code: [OpenArena gamecode](https://github.com/OpenArena/gamecode) (GPL v2), commit
  5478aad23b12857d265103f6aa2f5258c78799c8 with `source/openarena-gamecode-battle-royale.patch`.
  Build with `make`; the QVMs land in `build/release-*/oax/vm/`.
- Content: [OpenArena](https://openarena.ws) 0.8.8 (GPL v2 and compatible free licenses), trimmed
  to what this map and roster use. The "mature" character pack is left out.
