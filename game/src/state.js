// The game's shared state and its one update step: everything the modules above
// build is held here, and updateGame advances it all in a fixed order — the player,
// traffic, pedestrians, police, bullets, missions, taxi fares and packages — then
// moves the camera. main.js only reads this state and draws it.

import { PLAYER, VIEW, WORLD } from './config.js';
import { collideCircle, generateCity, randomSidewalkPoint } from './world.js';
import { createRandom, range } from './random.js';
import { driveCar, makeCar, separateCars, spawnParkedCar, spawnTrafficCar, updateTrafficCar } from './vehicles.js';
import { spawnPed, updatePed } from './pedestrians.js';
import { crimeSteal, decayHeat, updatePolice } from './police.js';
import { carHitsPed, playerPunch, playerShoot, updateBullets } from './combat.js';
import { PLACES, ensureTaxiPeds, startTaxi, updateMissions, updatePackages, updateTaxi } from './missions.js';
import { ACTION_INTERACT, ACTION_PUNCH } from './input.js';

const TRAFFIC_COUNT = 14;
const PARKED_COUNT = 10;
const PED_COUNT = 26;
const PACKAGE_COUNT = 5;

/** A fresh game: city, player on foot at Palmetto Plaza, traffic and pedestrians. */
export function createGame(seed) {
  const random = createRandom(seed);
  const city = generateCity(random);
  const state = {
    seed, random, city,
    time: 0,
    cash: 120,
    heat: 0,
    wanted: 0,
    lastCrimeAt: -100,
    banner: null,
    events: [],
    player: {
      x: PLACES.start.x, y: PLACES.start.y, angle: -Math.PI / 2,
      onFoot: true, car: null, health: PLAYER.health,
      gunTimer: 0, punchTimer: 0, invulnerable: 0, aimAngle: 0,
    },
    traffic: [],
    parked: [],
    policeCars: [],
    cops: [],
    peds: [],
    bullets: [],
    particles: [],
    packages: [],
    missionIndex: 0,
    missionStep: 0,
    completed: [],
    taxi: null,
    camera: { x: 0, y: 0 },
    over: null, // 'busted' | 'wasted' when the run ends
  };
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.traffic.push(spawnTrafficCar(random, city));
  for (let i = 0; i < PARKED_COUNT; i += 1) {
    const car = spawnParkedCar(random, city);
    if (car) state.parked.push(car);
  }
  // Two parked cars right by the start, so the first mission can begin at once.
  state.parked.push(
    makeCar(PLACES.start.x + 72, PLACES.start.y + 24, 0, '#c94f4f', 'parked'),
    makeCar(PLACES.start.x - 72, PLACES.start.y - 24, Math.PI, '#4f7ec9', 'parked'),
  );
  for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(spawnPed(random));
  for (let i = 0; i < PACKAGE_COUNT; i += 1) {
    const p = randomSidewalkPoint(random);
    state.packages.push({ x: p.x, y: p.y, got: false, respawn: 45, bob: range(random, 0, 6) });
  }
  state.allCars = () => [...state.traffic, ...state.parked, ...state.policeCars];
  return state;
}

/** Reset the run after busted/wasted, keeping cash and mission progress. */
export function respawn(state) {
  const p = state.player;
  p.x = PLACES.hospital.x;
  p.y = PLACES.hospital.y;
  p.onFoot = true;
  p.car = null;
  p.health = PLAYER.health;
  p.invulnerable = 2;
  state.heat = 0;
  state.wanted = 0;
  state.policeCars = [];
  state.cops = [];
  state.bullets = [];
  state.taxi = null;
  state.over = null;
  state.cash = Math.max(0, state.cash - 100);
  state.banner = { text: 'BACK ON THE STREET', sub: 'Hospital bill: -$100. Stay out of trouble.', until: state.time + 3.2 };
}

/** The nearest stealable car to the player, within reach, or null. */
function nearestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.allCars()) {
    if (car.dead || car.driver === 'player') continue;
    if (car.kind === 'traffic' && Math.abs(car.speed) > 30) continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** The nearest taxi-waiting pedestrian, within reach, or null. */
function nearestTaxiPed(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const ped of state.peds) {
    if (ped.dead || ped.state !== 'taxi') continue;
    const d = Math.hypot(ped.x - state.player.x, ped.y - state.player.y);
    if (d < bestD) { bestD = d; best = ped; }
  }
  return best;
}

/** What the E key does on foot: step into the nearest car in reach. */
export function interact(state) {
  const p = state.player;
  if (p.car) {
    // Get out: step to the side of the car.
    const side = p.car.angle + Math.PI / 2;
    p.x = p.car.x + Math.cos(side) * 30;
    p.y = p.car.y + Math.sin(side) * 30;
    p.onFoot = true;
    p.car.driver = null;
    p.car = null;
    p.angle = 0;
    return;
  }
  const car = nearestCar(state, 60);
  if (car) {
    p.car = car;
    p.onFoot = false;
    car.driver = 'player';
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (car.kind === 'parked') {
      car.kind = 'stolen';
      crimeSteal(state);
      state.events.push({ type: 'steal' });
    }
  }
}

/** One fixed step of the whole game. `snap` is the input snapshot for this frame. */
export function updateGame(state, snap, dt) {
  state.time += dt;
  const p = state.player;
  const random = state.random;

  if (p.gunTimer > 0) p.gunTimer -= dt;
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  if (state.banner && state.time > state.banner.until) state.banner = null;
  // Particles: sparks and smoke drift and fade.
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2 * dt;
    pt.vy *= 1 - 2 * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);

  // --- The player -----------------------------------------------------------
  if (p.car) {
    driveCar(p.car, snap.axes, dt, state.city);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    // Running a pedestrian over in the car.
    carHitsPed(state, p.car);
    if (p.car.health <= 0 && !p.car.dead) {
      p.car.dead = true;
      p.car.smoke = 1;
      state.events.push({ type: 'carWrecked', car: p.car });
    }
    if (p.car.dead) {
      // The car is wrecked: Danny bails out on foot.
      p.car.driver = null;
      p.car = null;
      p.onFoot = true;
      p.x += 30;
      p.health = Math.max(20, p.health - 15);
    } else if (snap.actions & ACTION_INTERACT) {
      // E in the car: pick up a waiting fare if one is at the kerb, else get out.
      const ped = nearestTaxiPed(state, 70);
      if (ped) {
        startTaxi(state, ped);
        ped.x = -1000; // riding along: hidden off the map
        ped.y = -1000;
      } else {
        interact(state);
      }
    }
  } else {
    // On foot: WASD moves, Shift runs, the mouse aims the pistol.
    const speed = snap.shift ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = snap.axes.x;
    let my = snap.axes.y;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      p.angle = Math.atan2(my, mx);
    }
    const resolved = collideCircle(state.city, p.x, p.y, PLAYER.radius);
    p.x = resolved.x;
    p.y = resolved.y;
    if (snap.mouseWorld) {
      p.aimAngle = Math.atan2(snap.mouseWorld.y - p.y, snap.mouseWorld.x - p.x);
    }
    if (snap.mouseDown) {
      playerShoot(state, snap.mouseWorld ? snap.mouseWorld.x : p.x + 100, snap.mouseWorld ? snap.mouseWorld.y : p.y);
    }
    if (snap.actions & ACTION_PUNCH) playerPunch(state);
    if (snap.actions & ACTION_INTERACT) interact(state);
  }

  // --- Traffic, pedestrians, police ----------------------------------------
  for (const car of state.traffic) {
    if (car.dead) continue;
    updateTrafficCar(car, random, dt, state.allCars());
  }
  // Traffic keeps its numbers: a wrecked car is replaced by a fresh one.
  state.traffic = state.traffic.filter((c) => !c.dead);
  while (state.traffic.length < TRAFFIC_COUNT) {
    const fresh = spawnTrafficCar(random, state.city);
    if (Math.hypot(fresh.x - p.x, fresh.y - p.y) > 500) state.traffic.push(fresh);
    else break;
  }
  const scare = state.events.some((e) => e.type === 'shot') ? { x: p.x, y: p.y } : null;
  for (const ped of state.peds) updatePed(ped, random, dt, state.city, scare);
  state.peds = state.peds.filter((ped) => !ped.dead || ped.state === 'taxi');
  while (state.peds.length < PED_COUNT) state.peds.push(spawnPed(random));

  const police = updatePolice(state, random, dt);
  if (police.busted) {
    state.over = 'busted';
    return;
  }
  decayHeat(state, dt);

  // --- Bullets, missions, fares, packages ----------------------------------
  updateBullets(state, dt);
  updateMissions(state);
  updateTaxi(state);
  updatePackages(state);
  ensureTaxiPeds(state);
  separateCars(state.allCars());

  // Slow health recovery while the heat is off.
  if (state.wanted === 0 && p.health > 0 && p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + 2.5 * dt);
  }
  if (p.health <= 0) {
    state.over = 'wasted';
    return;
  }

  // --- Camera: follow the player, clamped to the city ------------------------
  const tx = Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2));
  const ty = Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2));
  state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 6);
  state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 6);
}
