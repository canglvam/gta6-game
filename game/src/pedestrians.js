// Pedestrians: Coral Bay's residents, strolling the sidewalks. They walk from one
// sidewalk point to the next, pause, and pick a new one; gunfire or a speeding car
// nearby makes them run away. A few wait at kerbs as taxi fares.

import { collideCircle, randomSidewalkPoint } from './world.js';
import { pick, range } from './random.js';

export const PED_COLORS = ['#e8e8e8', '#d9a05f', '#7a9ac9', '#c97a7a', '#8ac97a', '#c9b458', '#9a7ac9', '#5fc9c2'];
export const PED_SHIRTS = ['#e5534b', '#4f8ff7', '#58d68d', '#f2c94c', '#c97ab0', '#e8e8e8', '#7a7a82', '#d98a5f'];

/** A fresh pedestrian at a sidewalk point. */
export function makePed(random, x, y) {
  return {
    x, y, angle: range(random, 0, Math.PI * 2),
    speed: range(random, 38, 62), target: null, pause: 0,
    state: 'walk', // 'walk' | 'flee' | 'taxi'
    shirt: pick(random, PED_SHIRTS), skin: pick(random, PED_COLORS),
    fleeX: 0, fleeY: 0, dead: false, bob: range(random, 0, Math.PI * 2),
  };
}

export function spawnPed(random) {
  const p = randomSidewalkPoint(random);
  return makePed(random, p.x, p.y);
}

/** One step: walk toward the target, pick a new one on arrival, flee when scared. */
export function updatePed(ped, random, dt, city, scare) {
  if (ped.dead) return;
  ped.bob += dt * 8;
  if (ped.state === 'flee') {
    const dx = ped.x - ped.fleeX;
    const dy = ped.y - ped.fleeY;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * 150 * dt;
    ped.y += (dy / d) * 150 * dt;
    const resolved = collideCircle(city, ped.x, ped.y, 10);
    ped.x = resolved.x;
    ped.y = resolved.y;
    if (d > 420) ped.state = 'walk';
    return;
  }
  if (scare && Math.hypot(ped.x - scare.x, ped.y - scare.y) < 260) {
    ped.state = 'flee';
    ped.fleeX = scare.x;
    ped.fleeY = scare.y;
    return;
  }
  if (ped.state === 'taxi') return; // waiting at the kerb for a fare
  if (ped.pause > 0) {
    ped.pause -= dt;
    return;
  }
  if (!ped.target) {
    const p = randomSidewalkPoint(random);
    ped.target = p;
  }
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    ped.target = null;
    ped.pause = range(random, 0.5, 3);
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.x += (dx / d) * ped.speed * dt;
  ped.y += (dy / d) * ped.speed * dt;
  // Pedestrians stay out of buildings (and out of the sea): slide along walls.
  const resolved = collideCircle(city, ped.x, ped.y, 10);
  ped.x = resolved.x;
  ped.y = resolved.y;
}
