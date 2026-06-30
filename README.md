# Maze of the Dead

A top-down zombie-apocalypse maze shooter with light RPG progression. Pure
HTML5 canvas + JavaScript — **no build step, no dependencies**. Just open
`game.html` in a browser.

## Controls
- **WASD** — move
- **Mouse** — aim
- **Click / hold** — shoot
- **R** — reload
- **M** — mute / unmute

## Project structure
```
game.html       Page markup: HUD, start/game-over overlay, canvas. Loads CSS + scripts.
styles.css      All styling for the shell (HUD, canvas sizing, overlay).
src/
  config.js     Config — maze layout, dimensions, balance numbers, the upgrade list.
                ↳ Tweak gameplay/difficulty here first.
  sound.js      Sound — procedural Web Audio effects. Public: Sound.init(), Sound.sfx.*
  maze.js       Maze — wall test, circle collision, random open cell.
  input.js      Input — keyboard + mouse state, with an onKeyDown callback.
  game.js       Game — state, spawning, update loop, rendering, HUD. The orchestrator.
```

Scripts are plain `<script defer>` files (loaded in the order above) that share a
few globals: `Config`, `Sound`, `Maze`, `Input`. This avoids ES modules so the
game runs straight off the filesystem (`file://`) without a local server.

## Where to make common changes
- **Difficulty / balance** (zombie HP & speed, wave size, chest timing, player
  base stats): `src/config.js`.
- **New gun upgrade**: add an entry to `Config.UPGRADES` in `src/config.js`.
- **New sound**: add a function to `sfx` in `src/sound.js`, call `Sound.sfx.name()`.
- **Visuals / rendering**: the `draw*` helpers in `src/game.js`.
