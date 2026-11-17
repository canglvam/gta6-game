# Coral Bay: Heat Rising

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/canglvam/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/canglvam/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D top-down open-world crime game for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01).

Danny Cole is back in Coral Bay — broke, and out of options. Explore a sun-soaked
coastal city on foot and by car: steal cars, outrun the Coral Bay police, run
three story missions for Mara Voss, pick up taxi fares, and grab cash packages
scattered around town. Four districts to explore — Downtown, Sunset Beach, the
Coral Docks, and Northgate — with traffic, pedestrians, a wanted level from 0 to
5 stars, police cruisers and foot cops, combat, a live minimap, and saving.

## Controls

- **WASD / arrows** — walk, or drive when in a car (W accelerate, S brake/reverse, A/D steer)
- **Shift** — run on foot
- **E** — steal a nearby car / get out / pick up a taxi fare
- **Mouse** — aim the pistol; **click** — shoot
- **F** — punch
- **P / Esc** — pause (progress saves)
- **S** (while paused) — save now
- **C** (on the title screen) — continue a saved game

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. No build step, no network —
the game is plain static files under `game/` (vanilla JS ES modules, canvas 2D,
WebAudio synthesis for sound).

## Layout

- `game/index.html` — the page
- `game/src/main.js` — boot and the game loop
- `game/src/config.js` — tuning numbers and palette
- `game/src/world.js` — the city: road grid, districts, buildings
- `game/src/state.js` — shared state and the one update step (player included)
- `game/src/vehicles.js` — traffic AI, parked cars, arcade driving
- `game/src/pedestrians.js` — sidewalk crowds
- `game/src/police.js` — wanted level, cruisers, foot cops, arrests
- `game/src/missions.js` — the three story missions, taxi fares, packages
- `game/src/combat.js` — fists, pistol, bullets
- `game/src/hud.js` — HUD and live minimap
- `game/src/render.js` — drawing the city and the menu screens
- `game/src/audio.js` — WebAudio sound synthesis
- `game/src/save.js` — localStorage save/load
- `game/src/shots.js` — the staged screenshot scenes (`?shot=chase|driving|mission|city`)
- `main.ts` — the make.fun hand-in program
- `serve.ts` — a tiny static server for local play

## License

MIT — see `LICENSE`.
