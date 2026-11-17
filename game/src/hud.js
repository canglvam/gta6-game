// The HUD: health and cash, wanted stars, the mission objective, the context hint,
// banners — and the live minimap, a canvas-drawn map of the whole city with the
// player, the police, the mission target, taxi fares and packages on it.

import { FONT, PALETTE, VIEW, WORLD } from './config.js';
import { missionMarker, missionObjective } from './missions.js';

const MAP_W = 208;
const MAP_H = 158;
const MAP_X = VIEW.width - MAP_W - 16;
const MAP_Y = VIEW.height - MAP_H - 16;

export function createHud() {
  const fonts = new Map();
  let context = null;

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function bar(x, y, w, h, frac, color, bg) {
    context.fillStyle = bg;
    context.fillRect(x, y, w, h);
    context.fillStyle = color;
    context.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  }

  function drawMinimap(state) {
    const sx = MAP_W / WORLD.width;
    const sy = MAP_H / WORLD.height;
    const px = (x) => MAP_X + x * sx;
    const py = (y) => MAP_Y + y * sy;
    context.fillStyle = PALETTE.minimapBg;
    context.beginPath();
    context.roundRect(MAP_X - 4, MAP_Y - 4, MAP_W + 8, MAP_H + 8, 8);
    context.fill();
    // Sea, sand, and the road grid.
    context.fillStyle = '#1f7fb8';
    context.fillRect(MAP_X, MAP_Y, 92 * sx, MAP_H);
    context.fillStyle = '#e3c98d';
    context.fillRect(MAP_X + 92 * sx, MAP_Y, (252 - 92) * sx, MAP_H);
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 1;
    for (const cx of state.city.roadX) {
      context.beginPath();
      context.moveTo(px(cx), MAP_Y);
      context.lineTo(px(cx), MAP_Y + MAP_H);
      context.stroke();
    }
    for (const cy of state.city.roadY) {
      context.beginPath();
      context.moveTo(MAP_X, py(cy));
      context.lineTo(MAP_X + MAP_W, py(cy));
      context.stroke();
    }
    // District blocks, faint.
    context.fillStyle = 'rgba(255,255,255,0.10)';
    for (const b of state.city.buildings) {
      context.fillRect(px(b.x), py(b.y), Math.max(1, b.w * sx), Math.max(1, b.h * sy));
    }
    // Packages, taxi fares, the mission target.
    context.fillStyle = PALETTE.gold;
    for (const pkg of state.packages) {
      if (pkg.got) continue;
      context.beginPath();
      context.arc(px(pkg.x), py(pkg.y), 2.5, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#58d68d';
    for (const ped of state.peds) {
      if (ped.state === 'taxi' && !ped.dead) {
        context.beginPath();
        context.arc(px(ped.x), py(ped.y), 2.5, 0, Math.PI * 2);
        context.fill();
      }
    }
    if (state.taxi) {
      context.fillStyle = '#58d68d';
      context.beginPath();
      context.arc(px(state.taxi.dest.x), py(state.taxi.dest.y), 4, 0, Math.PI * 2);
      context.fill();
    }
    const marker = missionMarker(state);
    if (marker) {
      context.fillStyle = PALETTE.marker;
      const mx = px(marker.x);
      const my = py(marker.y);
      context.beginPath();
      context.moveTo(mx, my - 6);
      context.lineTo(mx + 5, my);
      context.lineTo(mx, my + 6);
      context.lineTo(mx - 5, my);
      context.closePath();
      context.fill();
    }
    // Police cruisers, then the player on top.
    context.fillStyle = '#5fa8ff';
    for (const car of state.policeCars) {
      context.beginPath();
      context.arc(px(car.x), py(car.y), 3, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#111';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(px(state.player.x), py(state.player.y), 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    text('CORAL BAY', MAP_X + 6, MAP_Y - 8, 11, 'rgba(255,255,255,0.65)', 'left');
  }

  /** The one hint line for what the player can do right now. */
  function hintLine(state) {
    const p = state.player;
    if (p.car) {
      // A fare at the kerb?
      for (const ped of state.peds) {
        if (ped.state === 'taxi' && !ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 70) {
          return 'E — pick up the fare';
        }
      }
      const speed = Math.round(Math.abs(p.car.speed) * 0.12);
      return `E — get out · ${speed} mph · car ${Math.max(0, Math.round(p.car.health))}%`;
    }
    for (const car of state.allCars()) {
      if (!car.dead && Math.hypot(car.x - p.x, car.y - p.y) < 60) {
        return 'E — steal this car';
      }
    }
    for (const ped of state.peds) {
      if (ped.state === 'taxi' && !ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 70) {
        return 'A fare is waiting — get a car first';
      }
    }
    return 'WASD — move · Shift — run · Click — shoot · F — punch';
  }

  /** Draw the whole HUD over the world. `ctx` is the same canvas context. */
  function draw(ctx, state) {
    context = ctx;
    const p = state.player;
    // Health bar and cash, top left.
    bar(16, 16, 200, 18, p.health / 100, p.health > 30 ? PALETTE.health : PALETTE.healthLow, 'rgba(0,0,0,0.5)');
    context.strokeStyle = 'rgba(255,255,255,0.6)';
    context.lineWidth = 1;
    context.strokeRect(16.5, 16.5, 200, 18);
    text(`${Math.ceil(p.health)}`, 224, 32, 16, PALETTE.text, 'left');
    text(`$${state.cash}`, 16, 58, 26, PALETTE.gold, 'left');
    // Wanted stars, top right.
    const stars = state.wanted;
    text('★'.repeat(stars) + '☆'.repeat(5 - stars), VIEW.width - 16, 34, 30, stars > 0 ? PALETTE.gold : 'rgba(255,255,255,0.35)', 'right');
    text(stars > 0 ? 'WANTED' : 'CLEAN', VIEW.width - 16, 58, 13, stars > 0 ? '#ff9a9a' : 'rgba(255,255,255,0.5)', 'right');
    // Mission objective, top centre.
    const objective = missionObjective(state);
    context.fillStyle = 'rgba(12,18,30,0.66)';
    const ow = Math.min(640, 24 + objective.length * 7.2);
    context.beginPath();
    context.roundRect((VIEW.width - ow) / 2, 10, ow, 34, 8);
    context.fill();
    text(objective, VIEW.width / 2, 33, 15, PALETTE.text, 'center');
    // Banner, centre.
    if (state.banner) {
      text(state.banner.text, VIEW.width / 2, 96, 34, PALETTE.gold, 'center');
      if (state.banner.sub) text(state.banner.sub, VIEW.width / 2, 124, 18, PALETTE.text, 'center');
    }
    // Off-screen mission arrow: point at the target when it is out of view.
    const marker = missionMarker(state);
    if (marker) {
      const cam = state.camera;
      const mx = marker.x - cam.x;
      const my = marker.y - cam.y;
      if (mx < 40 || mx > VIEW.width - 40 || my < 80 || my > VIEW.height - 40) {
        const cx = VIEW.width / 2;
        const cy = VIEW.height / 2;
        const angle = Math.atan2(my - cy, mx - cx);
        const ax = cx + Math.cos(angle) * 300;
        const ay = cy + Math.sin(angle) * 220;
        context.save();
        context.translate(ax, ay);
        context.rotate(angle);
        context.fillStyle = PALETTE.marker;
        context.beginPath();
        context.moveTo(14, 0);
        context.lineTo(-10, -10);
        context.lineTo(-10, 10);
        context.closePath();
        context.fill();
        context.restore();
        text(`${Math.round(Math.hypot(mx - cx, my - cy))}m`, ax, ay + 26, 13, PALETTE.marker, 'center');
      }
    }
    // Hint line, bottom left.
    text(hintLine(state), 16, VIEW.height - 16, 15, 'rgba(255,255,255,0.85)', 'left');
    drawMinimap(state);
  }

  return { draw };
}
