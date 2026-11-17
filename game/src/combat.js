// Combat: the player's fists and pistol, bullets in flight, and what they hit.
// Shooting is mouse-aimed; punching is a short-range swing. Police shoot back
// (see police.js) and pedestrians flee (see pedestrians.js). A bullet that hits a
// car dents it; one that hits a cop or a pedestrian hurts them.

import { PLAYER } from './config.js';
import { crimeKillCop, crimeKillPed, crimeShoot } from './police.js';

export function makeBullet(x, y, angle, speed, from, damage) {
  return {
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    life: 1.2, from, damage,
  };
}

/** Fire the player's pistol toward a world point. Returns true if a shot went off. */
export function playerShoot(state, tx, ty) {
  if (state.player.gunTimer > 0) return false;
  state.player.gunTimer = PLAYER.gunCooldown;
  const dx = tx - state.player.x;
  const dy = ty - state.player.y;
  const angle = Math.atan2(dy, dx);
  state.bullets.push(makeBullet(
    state.player.x + Math.cos(angle) * 18,
    state.player.y + Math.sin(angle) * 18,
    angle, 900, 'player', PLAYER.gunDamage,
  ));
  state.player.aimAngle = angle;
  state.events.push({ type: 'shot' });
  crimeShoot(state);
  return true;
}

/** A punch at the nearest cop or pedestrian in range. */
export function playerPunch(state) {
  if (state.player.punchTimer > 0) return false;
  state.player.punchTimer = PLAYER.punchCooldown;
  state.events.push({ type: 'punch' });
  let best = null;
  let bestD = PLAYER.punchRange;
  for (const cop of state.cops) {
    if (cop.dead) continue;
    const d = Math.hypot(cop.x - state.player.x, cop.y - state.player.y);
    if (d < bestD) { bestD = d; best = cop; }
  }
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - state.player.x, ped.y - state.player.y);
    if (d < bestD) { bestD = d; best = ped; }
  }
  if (!best) return true;
  if (best.health !== undefined) {
    best.health -= PLAYER.punchDamage;
    if (best.health <= 0 && !best.dead) {
      best.dead = true;
      crimeKillCop(state);
      state.events.push({ type: 'copDown' });
    }
  } else {
    best.dead = true;
    crimeKillPed(state);
    state.events.push({ type: 'pedDown' });
  }
  return true;
}

/** Move bullets, test them against cars, cops, peds and the player, and clean up. */
export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (b.from === 'player') {
      // Hit a police car?
      for (const car of state.allCars()) {
        if (car.dead) continue;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
        const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along < 26 && across < 14) {
          car.health -= b.damage;
          b.life = 0;
          state.events.push({ type: 'carHit' });
          if (car.health <= 0 && !car.dead) {
            car.dead = true;
            car.smoke = 1;
            state.events.push({ type: 'carWrecked', car });
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a foot cop?
      for (const cop of state.cops) {
        if (cop.dead) continue;
        if (Math.hypot(b.x - cop.x, b.y - cop.y) < 14) {
          cop.health -= b.damage;
          b.life = 0;
          if (cop.health <= 0) {
            cop.dead = true;
            crimeKillCop(state);
            state.events.push({ type: 'copDown' });
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a pedestrian?
      for (const ped of state.peds) {
        if (ped.dead) continue;
        if (Math.hypot(b.x - ped.x, b.y - ped.y) < 14) {
          ped.dead = true;
          b.life = 0;
          crimeKillPed(state);
          state.events.push({ type: 'pedDown' });
          break;
        }
      }
    } else if (b.from === 'cop') {
      // A cop's bullet: the player, on foot or in the car.
      const px = state.player.x;
      const py = state.player.y;
      const radius = state.player.car ? 20 : 13;
      if (Math.hypot(b.x - px, b.y - py) < radius) {
        if (state.player.car) state.player.car.health -= b.damage;
        else state.player.health -= b.damage;
        b.life = 0;
        state.events.push({ type: 'playerHit', amount: b.damage });
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

/** A car running a pedestrian over: the ped goes down, the heat goes up. */
export function carHitsPed(state, car) {
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
    const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along < 28 && across < 16 && Math.abs(car.speed) > 60) {
      ped.dead = true;
      crimeHitPed(state);
      state.events.push({ type: 'pedDown' });
      state.events.push({ type: 'thud' });
    }
  }
}
