// The screenshot scenes behind ?shot=chase|driving|mission|city. Each one builds a
// real game from a fixed seed, puts Danny in the middle of the scene the shot is
// about (a police chase, a drive through town, a mission pickup, a walk on the
// beach), plays the real rules forward for a few seconds with a simple autopilot,
// and hands back the screen to draw — so the frame is what real play looks like,
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { updateGame } from './state.js';
import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { SCREEN_PLAY } from './render.js';

/** Drive straight down a road, steering gently back to its centreline. */
function roadPilot(state, roadX) {
  const car = state.player.car;
  const steer = Math.max(-1, Math.min(1, (car.x - roadX) / 40));
  return {
    axes: { x: steer, y: -1 },
    shift: false, mouseX: 0, mouseY: 0, mouseDown: false, actions: 0,
    mouseWorld: null,
  };
}

function idleSnap() {
  return { axes: { x: 0, y: 0 }, shift: false, mouseX: 0, mouseY: 0, mouseDown: false, actions: 0, mouseWorld: null };
}

function walkSnap() {
  return { axes: { x: 1, y: 0 }, shift: false, mouseX: 0, mouseY: 0, mouseDown: false, actions: 0, mouseWorld: null };
}

function putPlayerInCar(state, x, y, angle, color) {
  const car = makeCar(x, y, angle, color || '#c94f4f', 'parked');
  car.kind = 'stolen';
  state.parked.push(car);
  state.player.car = car;
  state.player.onFoot = false;
  car.driver = 'player';
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  car.speed = 220;
  return car;
}

function addPoliceBehind(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const car = makeCar(x + (i - 1) * 70, y - 90 - i * 60, Math.PI / 2, '#2f6fd8', 'police');
    car.speed = 260;
    state.policeCars.push(car);
  }
}

function addPedsNear(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const ped = makePed(state.random, x + (state.random() - 0.5) * 320, y + (state.random() - 0.5) * 260);
    state.peds.push(ped);
  }
}

/**
 * Set `state` to the named scene and play it forward, then return the screen
 * to draw over it. Unknown names stage the city walk.
 */
export function stageShot(name, state) {
  const p = state.player;
  if (name === 'chase') {
    // Mission 2's delivery run, wanted level 3, three cruisers on Danny's tail.
    state.missionIndex = 1;
    state.missionStep = 2;
    state.heat = 62;
    state.wanted = 3;
    state.lastCrimeAt = state.time;
    putPlayerInCar(state, 1500, 1000, Math.PI / 2, '#e8c84f');
    addPoliceBehind(state, 1500, 1000, 3);
    // Oncoming and same-way traffic on the same road, set up as proper road followers.
    for (let i = 0; i < 5; i += 1) {
      const lane = i % 2 === 0 ? 1 : -1;
      const dir = i % 2 === 0 ? 1 : -1;
      const car = makeCar(1500 + lane * 24, 1250 + i * 130, dir > 0 ? Math.PI / 2 : -Math.PI / 2, '#4f7ec9', 'traffic');
      car.axis = 'v';
      car.road = 3;
      car.lane = lane;
      car.dir = dir;
      car.speed = 150;
      state.traffic.push(car);
    }
    for (let i = 0; i < 150; i += 1) updateGame(state, roadPilot(state, 1500), STEP);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'driving') {
    // A sunny cruise down the beachfront drive, traffic all around.
    putPlayerInCar(state, 300, 700, Math.PI / 2, '#4fc98a');
    addPedsNear(state, 200, 900, 6);
    for (let i = 0; i < 120; i += 1) updateGame(state, roadPilot(state, 300), STEP);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Mission 2's pickup on Sunset Beach, on foot, package beacon glowing.
    state.missionIndex = 1;
    state.missionStep = 1;
    p.x = 470;
    p.y = 800;
    p.aimAngle = Math.PI / 2;
    addPedsNear(state, 420, 850, 8);
    for (let i = 0; i < 40; i += 1) updateGame(state, idleSnap(), STEP);
    return { screen: SCREEN_PLAY };
  }
  // city: a walk along the beach promenade, pedestrians everywhere.
  p.x = 210;
  p.y = 1300;
  p.angle = Math.PI / 2;
  addPedsNear(state, 220, 1300, 14);
  for (let i = 0; i < 90; i += 1) updateGame(state, walkSnap(), STEP);
  return { screen: SCREEN_PLAY };
}
