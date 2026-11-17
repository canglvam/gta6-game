// The wanted system and the Coral Bay police. Heat rises when the player commits
// crimes and cools when they lie low; stars come from heat. Police cruisers chase
// the player's car and ram it, foot cops chase the player on foot, punch them, and
// shoot once the heat is high. A foot cop who stays close long enough arrests the
// player: busted.

import { CRIME, HEAT_CALM, HEAT_DECAY, POLICE, WANTED_HEAT } from './config.js';
import { chasePoint, makeCar } from './vehicles.js';
import { randomRoadPoint } from './world.js';
import { range } from './random.js';

/** Stars (0..5) for a heat value. */
export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 0; i < WANTED_HEAT.length; i += 1) {
    if (heat >= WANTED_HEAT[i]) stars = i;
  }
  return stars;
}

/** Add heat for a crime and note when it happened (for the cooldown before decay). */
export function addHeat(state, amount) {
  state.heat = Math.min(100, state.heat + amount);
  state.lastCrimeAt = state.time;
  state.wanted = starsForHeat(state.heat);
}

export function crimeSteal(state) { addHeat(state, CRIME.stealCar); }
export function crimeHitPed(state) { addHeat(state, CRIME.hitPed); }
export function crimeShoot(state) { addHeat(state, CRIME.shoot); }
export function crimeKillCop(state) { addHeat(state, CRIME.killCop); }
export function crimeKillPed(state) { addHeat(state, CRIME.killPed); }

/** Heat cools off when the player has been quiet for a while. */
export function decayHeat(state, dt) {
  if (state.time - state.lastCrimeAt > HEAT_CALM && state.heat > 0) {
    state.heat = Math.max(0, state.heat - HEAT_DECAY * dt);
    state.wanted = starsForHeat(state.heat);
  }
}

function spawnPoliceCar(random, state) {
  // Spawn on a road a little way from the player, on the player's side of the map.
  for (let tries = 0; tries < 8; tries += 1) {
    const p = randomRoadPoint(random);
    const d = Math.hypot(p.x - state.player.x, p.y - state.player.y);
    if (d > 420 && d < 900) {
      const car = makeCar(p.x, p.y, 0, '#2f6fd8', 'police');
      car.speed = 200;
      return car;
    }
  }
  const p = randomRoadPoint(random);
  const car = makeCar(p.x, p.y, 0, '#2f6fd8', 'police');
  car.speed = 200;
  return car;
}

function spawnFootCop(random, state) {
  const angle = range(random, 0, Math.PI * 2);
  const dist = range(random, 320, 480);
  return {
    x: state.player.x + Math.cos(angle) * dist,
    y: state.player.y + Math.sin(angle) * dist,
    angle: 0, health: 50, shootTimer: range(random, 0.4, 1.2),
    punchTimer: 0, arrest: 0, dead: false, bob: 0,
  };
}

/**
 * Keep the police presence matched to the wanted level, move the cruisers and the
 * foot cops, and report what happened: 'busted' when an arrest completes.
 * Returns an object with { busted, rammed } flags the caller reacts to.
 */
export function updatePolice(state, random, dt) {
  const out = { busted: false, rammed: false };
  const stars = state.wanted;
  // Cruisers: one per star, up to five.
  while (state.policeCars.length < stars) {
    state.policeCars.push(spawnPoliceCar(random, state));
  }
  while (state.policeCars.length > stars) {
    state.policeCars.pop();
  }
  // Foot cops: only when the player is on foot and wanted, one per star up to three.
  const wantCops = state.player.car ? 0 : Math.min(3, stars);
  while (state.cops.length < wantCops) state.cops.push(spawnFootCop(random, state));
  while (state.cops.length > wantCops) state.cops.pop();

  for (const car of state.policeCars) {
    if (car.dead) continue;
    const rammed = chasePoint(car, state.player.x, state.player.y, dt, state.city, POLICE.carSpeed);
    if (rammed) {
      out.rammed = true;
      if (state.player.car) state.player.car.health -= POLICE.carRamDamage * dt * 8;
      else state.player.health -= POLICE.carRamDamage * dt * 4;
    }
    // A wrecked cruiser smokes and stops.
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      car.smoke = 1;
      state.events.push({ type: 'copCarDown' });
    }
    if (car.smoke > 0) car.smoke = Math.max(0, car.smoke - dt * 0.1);
  }

  for (const cop of state.cops) {
    if (cop.dead) continue;
    const dx = state.player.x - cop.x;
    const dy = state.player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    cop.bob += dt * 9;
    if (dist > 30) {
      cop.x += (dx / dist) * POLICE.copSpeed * dt;
      cop.y += (dy / dist) * POLICE.copSpeed * dt;
      cop.arrest = Math.max(0, cop.arrest - dt * 2);
    } else {
      // Close enough to grab: hold on and the player is busted.
      cop.arrest += dt;
      if (cop.arrest >= POLICE.arrestSeconds) {
        out.busted = true;
        return out;
      }
      // ...or punch while holding on.
      cop.punchTimer -= dt;
      if (cop.punchTimer <= 0) {
        cop.punchTimer = 0.8;
        state.player.health -= POLICE.copPunchDamage;
        state.events.push({ type: 'playerHit', amount: POLICE.copPunchDamage });
      }
    }
    // Shoot back once the heat is high and the player is in range.
    if (stars >= 2 && dist < POLICE.copShootRange && dist > 60) {
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0) {
        cop.shootTimer = POLICE.copShootCooldown + range(random, 0, 0.5);
        state.bullets.push({
          x: cop.x, y: cop.y,
          vx: (dx / dist) * 620, vy: (dy / dist) * 620,
          life: 1.1, from: 'cop', damage: POLICE.copBulletDamage,
        });
        state.events.push({ type: 'copShot' });
      }
    }
  }
  return out;
}
