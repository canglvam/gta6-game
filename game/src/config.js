// Coral Bay: Heat Rising — every tuning number and colour in one place.
// The world is a fixed 3400x2600 city; the renderer shows a 1280x720 window of it
// through a camera that follows the player, so no rule here depends on screen size.

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3400, height: 2600 };
export const STEP = 1 / 60;

/** Road centrelines. Vertical roads run north-south, horizontal roads east-west. */
export const ROAD_W = 96;
export const ROAD_X = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const ROAD_Y = [250, 550, 850, 1150, 1450, 1750, 2050, 2350];

/** The beach strip (west edge) and the sea beyond it. */
export const BEACH = { sandFrom: 0, sandTo: 252, waterTo: 92 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 205,
  runSpeed: 265,
  health: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.45,
  gunDamage: 34,
  gunCooldown: 0.22,
  gunRange: 520,
  invulnerable: 1.0,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  drag: 0.55,
  health: 100,
};

export const POLICE = {
  carSpeed: 600,
  carRamDamage: 9,
  copSpeed: 165,
  copPunchDamage: 8,
  copShootRange: 340,
  copShootCooldown: 1.1,
  copBulletDamage: 7,
  arrestSeconds: 1.4,
};

/** Wanted stars from heat: heat 0..100, thresholds give stars 0..5. */
export const WANTED_HEAT = [0, 15, 35, 55, 75, 95];
export const CRIME = { stealCar: 16, hitPed: 22, shoot: 12, killCop: 30, killPed: 26 };
export const HEAT_DECAY = 1.4;
export const HEAT_CALM = 6;

export const MISSION_REWARD = [300, 500, 1200];
export const TAXI_FARE_MIN = 40;
export const TAXI_FARE_PER_PX = 0.06;
export const PACKAGE_CASH = 50;

export const PALETTE = {
  sea: '#2f9fd8',
  seaDeep: '#1f7fb8',
  sand: '#f0d9a0',
  sandWet: '#e3c98d',
  grass: '#7fc46a',
  park: '#6db85a',
  sidewalk: '#c9c2b4',
  road: '#3d3f45',
  roadEdge: '#2c2e33',
  lane: '#e8d44f',
  downtown: '#8f9bb0',
  downtownRoof: '#6d7a90',
  tower: '#aab6c8',
  shop: '#d98a5f',
  house: '#e8b48a',
  houseRoof: '#b65c48',
  warehouse: '#9aa08a',
  container: '#c96a3b',
  text: '#ffffff',
  textDark: '#1c2430',
  muted: '#9aa7b8',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4f8ff7',
  police: '#2f6fd8',
  health: '#58d68d',
  healthLow: '#e5534b',
  panel: 'rgba(12, 18, 30, 0.82)',
  marker: '#ffd23e',
  minimapBg: 'rgba(10, 16, 26, 0.78)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'coralbay.save.v1';
export const BEST_KEY = 'coralbay.best.v1';
