// The city of Coral Bay: a road grid, four districts, and every building in it.
// generateCity builds the whole map from a seed; the rest of the game only asks it
// questions (is this point on a road? does this circle hit a building? what district
// is this?). Nothing here draws or knows about the browser.

import { BEACH, PALETTE, ROAD_W, ROAD_X, ROAD_Y, WORLD } from './config.js';
import { int, pick, range } from './random.js';

export const DISTRICT_DOWNTOWN = 'downtown';
export const DISTRICT_BEACH = 'beach';
export const DISTRICT_DOCKS = 'docks';
export const DISTRICT_SUBURBS = 'suburbs';
export const DISTRICT_MIDTOWN = 'midtown';

/** Which district a point belongs to. */
export function districtAt(x, y) {
  if (x < BEACH.sandTo) return DISTRICT_BEACH;
  if (x > 2400 && y > 1850) return DISTRICT_DOCKS;
  if (y < 520) return DISTRICT_SUBURBS;
  if (x > 1000 && x < 2400 && y > 750 && y < 1550) return DISTRICT_DOWNTOWN;
  return DISTRICT_MIDTOWN;
}

/** True when the point is on a road (or on the beach sand, which cars may also use). */
export function onRoad(x, y) {
  const half = ROAD_W / 2;
  for (const cx of ROAD_X) if (Math.abs(x - cx) <= half) return true;
  for (const cy of ROAD_Y) if (Math.abs(y - cy) <= half) return true;
  return false;
}

/** The nearest road centreline point to (x, y), for snapping traffic onto roads. */
export function nearestRoadPoint(x, y) {
  let bestX = ROAD_X[0];
  let bestD = Math.abs(x - ROAD_X[0]);
  for (const cx of ROAD_X) {
    if (Math.abs(x - cx) < bestD) {
      bestD = Math.abs(x - cx);
      bestX = cx;
    }
  }
  let bestY = ROAD_Y[0];
  bestD = Math.abs(y - ROAD_Y[0]);
  for (const cy of ROAD_Y) {
    if (Math.abs(y - cy) < bestD) {
      bestD = Math.abs(y - cy);
      bestY = cy;
    }
  }
  // Prefer the closer of the two axes.
  if (Math.abs(x - bestX) <= Math.abs(y - bestY)) return { x: bestX, y, axis: 'v' };
  return { x, y: bestY, axis: 'h' };
}

const HOUSE_COLORS = ['#e8b48a', '#d9a06f', '#c98f7a', '#e0c08f', '#b8c4a0'];
const SHOP_COLORS = ['#d98a5f', '#c97a6a', '#d9b45f', '#8fa8c9', '#b08fc9'];
const TOWER_COLORS = ['#aab6c8', '#9fb0c4', '#b8c4d4', '#8f9bb0'];
const WAREHOUSE_COLORS = ['#9aa08a', '#8a9480', '#a8a08a'];

function blockBuildings(random, x0, y0, x1, y1, district) {
  const list = [];
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 60 || h < 60) return list;
  if (district === DISTRICT_DOCKS) {
    // Warehouses: one or two big sheds, plus container stacks outside them.
    const sheds = random() < 0.5 ? 1 : 2;
    for (let i = 0; i < sheds; i += 1) {
      const bw = range(random, w * 0.35, w * 0.55);
      const bh = range(random, h * 0.4, h * 0.6);
      const bx = x0 + (i === 0 ? 8 : w - bw - 8);
      const by = y0 + range(random, 8, h - bh - 8);
      list.push({
        x: bx, y: by, w: bw, h: bh, kind: 'warehouse',
        color: pick(random, WAREHOUSE_COLORS), roof: '#6d7466', tall: 0,
      });
    }
    for (let i = 0; i < int(random, 2, 4); i += 1) {
      list.push({
        x: range(random, x0 + 6, x1 - 70), y: range(random, y0 + 6, y1 - 26),
        w: range(random, 44, 62), h: 20, kind: 'container',
        color: pick(random, ['#c96a3b', '#4f8fb7', '#7a9a4f', '#b7a23b']), roof: '', tall: 0,
      });
    }
    return list;
  }
  if (district === DISTRICT_SUBURBS) {
    // Houses with gardens: up to four small homes.
    const cols = w > 240 ? 2 : 1;
    const rows = h > 220 ? 2 : 1;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (random() < 0.15) continue;
        const bw = range(random, 52, 78);
        const bh = range(random, 44, 64);
        const bx = x0 + 14 + c * (w / cols) + range(random, 0, Math.max(0, w / cols - bw - 24));
        const by = y0 + 14 + r * (h / rows) + range(random, 0, Math.max(0, h / rows - bh - 24));
        list.push({
          x: bx, y: by, w: bw, h: bh, kind: 'house',
          color: pick(random, HOUSE_COLORS), roof: pick(random, ['#b65c48', '#7a5a48', '#4f6a8a']), tall: 0,
        });
      }
    }
    return list;
  }
  if (district === DISTRICT_DOWNTOWN) {
    // Tall towers, one or two per block, with a plaza gap.
    const towers = random() < 0.6 ? 2 : 1;
    for (let i = 0; i < towers; i += 1) {
      const bw = range(random, 90, Math.min(150, w - 30));
      const bh = range(random, 80, Math.min(140, h - 30));
      const bx = x0 + (towers === 1 ? (w - bw) / 2 : i === 0 ? 12 : w - bw - 12);
      const by = y0 + (h - bh) / 2 + range(random, -14, 14);
      list.push({
        x: bx, y: by, w: bw, h: bh, kind: 'tower',
        color: pick(random, TOWER_COLORS), roof: '#5d6a80', tall: int(random, 2, 4),
      });
    }
    return list;
  }
  // Midtown shops and apartments: a row of two or three mid-size blocks.
  const count = int(random, 2, 3);
  for (let i = 0; i < count; i += 1) {
    const bw = range(random, 64, Math.min(120, w - 24));
    const bh = range(random, 56, Math.min(110, h - 24));
    const bx = x0 + 10 + (i * (w - 20)) / count + range(random, 0, Math.max(0, w / count - bw - 12));
    const by = y0 + (h - bh) / 2 + range(random, -10, 10);
    list.push({
      x: bx, y: by, w: bw, h: bh, kind: 'shop',
      color: pick(random, SHOP_COLORS), roof: '#6d5a48', tall: random() < 0.35 ? 1 : 0,
    });
  }
  return list;
}

/**
 * Build the city. Returns { buildings, trees, parks, roadX, roadY }.
 * Parks replace buildings on two chosen blocks; trees dot the parks and the beach.
 */
export function generateCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const half = ROAD_W / 2;
  const xs = [BEACH.sandTo, ...ROAD_X, WORLD.width];
  const ys = [0, ...ROAD_Y, WORLD.height];
  // Two park blocks: one midtown, one in the suburbs.
  const parkCells = new Set(['3,2', '5,0']);
  for (let ix = 0; ix < xs.length - 1; ix += 1) {
    for (let iy = 0; iy < ys.length - 1; iy += 1) {
      const x0 = xs[ix] + (ix === 0 ? 0 : half) + 8;
      const x1 = xs[ix + 1] - (ix === xs.length - 2 ? 0 : half) - 8;
      const y0 = ys[iy] + (iy === 0 ? 0 : half) + 8;
      const y1 = ys[iy + 1] - (iy === ys.length - 2 ? 0 : half) - 8;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      if (parkCells.has(`${ix},${iy}`)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < int(random, 5, 8); t += 1) {
          trees.push({ x: range(random, x0 + 16, x1 - 16), y: range(random, y0 + 16, y1 - 16), r: range(random, 9, 14) });
        }
        continue;
      }
      if (district === DISTRICT_BEACH) continue;
      buildings.push(...blockBuildings(random, x0, y0, x1, y1, district));
    }
  }
  // Palm trees along the beachfront.
  for (let y = 120; y < WORLD.height - 100; y += int(random, 90, 150)) {
    trees.push({ x: range(random, 150, 225), y, r: 12, palm: true });
  }
  return { buildings, trees, parks, roadX: ROAD_X, roadY: ROAD_Y };
}

/** Push a circle (x, y, radius) out of every building and the sea it overlaps. */
export function collideCircle(city, x, y, radius) {
  let nx = x;
  let ny = y;
  // The sea is solid: stay east of the waterline.
  if (nx - radius < BEACH.waterTo) nx = BEACH.waterTo + radius;
  // World edges.
  nx = Math.max(radius, Math.min(WORLD.width - radius, nx));
  ny = Math.max(radius, Math.min(WORLD.height - radius, ny));
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 === 0) {
      // Centre inside the building: push out along the shortest side.
      const left = nx - b.x;
      const right = b.x + b.w - nx;
      const top = ny - b.y;
      const bottom = b.y + b.h - ny;
      const m = Math.min(left, right, top, bottom);
      if (m === left) nx = b.x - radius;
      else if (m === right) nx = b.x + b.w + radius;
      else if (m === top) ny = b.y - radius;
      else ny = b.y + b.h + radius;
    } else {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * radius;
      ny = cy + (dy / d) * radius;
    }
  }
  return { x: nx, y: ny };
}

/** True when a circle overlaps any building (used to keep spawns out of walls). */
export function hitsBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

/** A random point on a road, for spawning cars and pedestrians. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    return { x: pick(random, ROAD_X), y: range(random, 60, WORLD.height - 60) };
  }
  return { x: range(random, 320, WORLD.width - 60), y: pick(random, ROAD_Y) };
}

/** A random point on a sidewalk (just off a road), for pedestrians. */
export function randomSidewalkPoint(random) {
  const p = randomRoadPoint(random);
  const off = ROAD_W / 2 + 14;
  if (random() < 0.5) p.x += random() < 0.5 ? off : -off;
  else p.y += random() < 0.5 ? off : -off;
  return { x: Math.max(110, Math.min(WORLD.width - 20, p.x)), y: Math.max(20, Math.min(WORLD.height - 20, p.y)) };
}

export { PALETTE };
