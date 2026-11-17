// The story and the side work. Danny Cole, a driver fresh out of a job, is pulled
// back into Coral Bay's streets by his old friend Mara Voss. Three story missions
// form the arc; taxi fares and cash packages pay along the way. Each mission is a
// short list of steps; the HUD shows the current step, and completing a mission
// pays cash and saves the game.

import { MISSION_REWARD, PACKAGE_CASH, TAXI_FARE_MIN, TAXI_FARE_PER_PX } from './config.js';
import { addHeat } from './police.js';
import { pick, range } from './random.js';

/** Mission markers: where in the city each story beat happens. */
export const PLACES = {
  start: { x: 1500, y: 1150, name: 'Palmetto Plaza' },
  docksDrop: { x: 2850, y: 2150, name: 'Coral Docks' },
  beachPickup: { x: 420, y: 850, name: 'Sunset Beach' },
  suburbsHideout: { x: 1100, y: 350, name: 'Marla\'s Hideout' },
  bank: { x: 1900, y: 1150, name: 'Coral Bay Bank' },
  hospital: { x: 700, y: 1150, name: 'Coral General' },
};

export const STORY = [
  {
    id: 'first-wheels',
    title: 'Mission 1 — First Wheels',
    briefing: 'Mara needs a driver. Steal any car and bring it to the docks.',
    steps: [
      { type: 'stealCar', text: 'Steal a car (walk up to one and press E)' },
      { type: 'driveTo', place: 'docksDrop', text: 'Drive the car to the Coral Docks' },
    ],
  },
  {
    id: 'hot-pickup',
    title: 'Mission 2 — Hot Pickup',
    briefing: 'A package is waiting on Sunset Beach. Grab it, then run it to Marla\'s hideout. The cops will notice.',
    steps: [
      { type: 'driveTo', place: 'beachPickup', text: 'Drive to the package on Sunset Beach' },
      { type: 'pickup', place: 'beachPickup', text: 'Get out and grab the package' },
      { type: 'driveTo', place: 'suburbsHideout', text: 'Deliver the package to Marla\'s hideout' },
    ],
  },
  {
    id: 'coral-job',
    title: 'Mission 3 — The Coral Job',
    briefing: 'The big one: the Coral Bay Bank. Get in, grab the cash, and lose the cops at the docks.',
    steps: [
      { type: 'driveTo', place: 'bank', text: 'Drive to the Coral Bay Bank' },
      { type: 'grabCash', place: 'bank', text: 'Get out and grab the cash inside' },
      { type: 'driveTo', place: 'docksDrop', text: 'Escape to the Coral Docks — wanted level 3!' },
    ],
  },
];

export function missionObjective(state) {
  if (state.missionIndex >= STORY.length) return 'All missions done — free roam! Earn cash with taxi fares and packages.';
  const mission = STORY[state.missionIndex];
  const step = mission.steps[state.missionStep];
  return `${mission.title}: ${step.text}`;
}

function stepTarget(state) {
  const mission = STORY[state.missionIndex];
  if (!mission) return null;
  const step = mission.steps[state.missionStep];
  if (!step || !step.place) return null;
  return PLACES[step.place];
}

export function missionMarker(state) {
  const target = stepTarget(state);
  if (!target) return null;
  const step = STORY[state.missionIndex].steps[state.missionStep];
  return { x: target.x, y: target.y, label: target.name, type: step.type };
}

function banner(state, text, sub) {
  state.banner = { text, sub: sub || '', until: state.time + 3.2 };
}

function completeMission(state) {
  const reward = MISSION_REWARD[state.missionIndex];
  state.cash += reward;
  state.completed.push(STORY[state.missionIndex].id);
  banner(state, 'MISSION COMPLETE', `+$${reward}  —  ${STORY[state.missionIndex].title}`);
  state.events.push({ type: 'missionComplete', reward });
  state.missionIndex += 1;
  state.missionStep = 0;
  state.events.push({ type: 'save' });
  if (state.missionIndex < STORY.length) {
    banner(state, STORY[state.missionIndex].title, STORY[state.missionIndex].briefing);
  } else {
    banner(state, 'ALL MISSIONS COMPLETE', 'Coral Bay is yours. Free roam!');
  }
}

function advanceStep(state) {
  const mission = STORY[state.missionIndex];
  state.missionStep += 1;
  if (state.missionStep >= mission.steps.length) completeMission(state);
  else state.events.push({ type: 'stepComplete' });
}

/** The current step's target point, or null when the step has no destination. */
export function currentTarget(state) {
  return stepTarget(state);
}

export function startTaxi(state, ped) {
  const dest = pick(state.random, [
    { x: 1500, y: 550, name: 'Northgate Mall' },
    { x: 2300, y: 1750, name: 'Harbor View' },
    { x: 700, y: 2050, name: 'Old Town' },
    { x: 2700, y: 850, name: 'Eastside Plaza' },
    { x: 1100, y: 1750, name: 'Riverside' },
  ]);
  state.taxi = { ped, dest, pickupX: ped.x, pickupY: ped.y, fare: 0 };
  ped.state = 'taxi';
  banner(state, 'TAXI FARE', `Take the passenger to ${dest.name}`);
  state.events.push({ type: 'taxiStart' });
}

export function updateTaxi(state) {
  const taxi = state.taxi;
  if (!taxi) return;
  const dest = taxi.dest;
  const dist = Math.hypot(state.player.x - dest.x, state.player.y - dest.y);
  if (dist < 70) {
    const fare = Math.max(TAXI_FARE_MIN, Math.round(TAXI_FARE_MIN + Math.hypot(taxi.pickupX - dest.x, taxi.pickupY - dest.y) * TAXI_FARE_PER_PX));
    state.cash += fare;
    banner(state, 'FARE PAID', `+$${fare} — thanks for the ride!`);
    state.events.push({ type: 'taxiPaid', fare });
    taxi.ped.state = 'walk';
    taxi.ped.target = null;
    taxi.ped.x = dest.x + 40; // the passenger climbs out at the destination
    taxi.ped.y = dest.y + 40;
    state.taxi = null;
  }
}

/** Story progress: call every step with the player's position and car state. */
export function updateMissions(state) {
  if (state.missionIndex >= STORY.length) return;
  const mission = STORY[state.missionIndex];
  const step = mission.steps[state.missionStep];
  const target = stepTarget(state);
  const px = state.player.x;
  const py = state.player.y;

  if (step.type === 'stealCar') {
    if (state.player.car) {
      advanceStep(state);
      banner(state, 'WHEELS ACQUIRED', 'Now get to the docks');
    }
    return;
  }
  if (!target) return;
  const dist = Math.hypot(px - target.x, py - target.y);
  if (step.type === 'driveTo') {
    if (dist < 80) {
      if (state.missionIndex === 2 && state.missionStep === 2) {
        // Escaped: the heat dies down once the player reaches the docks.
        state.heat = 0;
        state.wanted = 0;
      }
      advanceStep(state);
    }
    return;
  }
  if (step.type === 'pickup' || step.type === 'grabCash') {
    if (dist < 46 && !state.player.car) {
      if (step.type === 'grabCash') {
        addHeat(state, 60); // the alarm goes off: wanted level 3
        banner(state, 'THE ALARM IS UP', 'Wanted level 3 — run!');
      }
      advanceStep(state);
    }
    return;
  }
}

/** Cash packages scattered around the city: walk or drive over one to collect it. */
export function updatePackages(state) {
  for (const pkg of state.packages) {
    if (pkg.got) continue;
    const d = Math.hypot(state.player.x - pkg.x, state.player.y - pkg.y);
    if (d < 34) {
      pkg.got = true;
      state.cash += PACKAGE_CASH;
      state.events.push({ type: 'package', amount: PACKAGE_CASH });
      banner(state, `+$${PACKAGE_CASH}`, 'Package collected');
    }
  }
  // A collected package comes back after a while, somewhere new.
  for (const pkg of state.packages) {
    if (!pkg.got) continue;
    pkg.respawn -= 1 / 60;
    if (pkg.respawn <= 0) {
      pkg.got = false;
      pkg.x = range(state.random, 400, 3200);
      pkg.y = range(state.random, 150, 2450);
      pkg.respawn = 45;
    }
  }
}

/** Fresh taxi-waiting pedestrians: keep two on the streets. */
export function ensureTaxiPeds(state) {
  let waiting = 0;
  for (const ped of state.peds) if (ped.state === 'taxi') waiting += 1;
  if (waiting >= 2 || state.taxi) return;
  for (const ped of state.peds) {
    if (ped.state === 'walk' && !ped.dead) {
      ped.state = 'taxi';
      return;
    }
  }
}
