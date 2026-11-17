// Cars: traffic that follows the road grid, parked cars waiting to be stolen, and
// police cruisers. A car is a small arcade physics body; traffic cars instead steer
// themselves along road centrelines and turn at intersections.

import { CAR, ROAD_W, ROAD_X, ROAD_Y, WORLD } from './config.js';
import { collideCircle, hitsBuilding, randomRoadPoint } from './world.js';
import { pick, range } from './random.js';

export const CAR_COLORS = ['#c94f4f', '#4f7ec9', '#e8c84f', '#7a7a82', '#4fc98a', '#c97ab0', '#e8e8e8', '#3a3a3a', '#c97a2e'];
export const POLICE_COLOR = '#2f6fd8';

/** A fresh car at a position, facing `angle` radians. */
export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color, kind: kind || 'traffic',
    health: CAR.health, dead: false, smoke: 0,
    // Traffic AI: which road it follows, which way, and which lane.
    axis: 'v', road: 0, dir: 1, lane: 1, cruise: 150, stuck: 0,
    driver: null, // 'player' when the player drives it
  };
}

/** Put a traffic car on a random road, facing along it. */
export function spawnTrafficCar(random, city) {
  const p = randomRoadPoint(random);
  const axis = ROAD_X.includes(p.x) ? 'v' : 'h';
  const car = makeCar(p.x, p.y, 0, pick(random, CAR_COLORS), 'traffic');
  if (axis === 'v') {
    car.axis = 'v';
    car.road = ROAD_X.indexOf(ROAD_X.reduce((a, b) => (Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a)));
    car.lane = random() < 0.5 ? 1 : -1;
    car.dir = random() < 0.5 ? 1 : -1;
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.x = ROAD_X[car.road] + car.lane * 24;
    car.y = range(random, 80, WORLD.height - 80);
  } else {
    car.axis = 'h';
    car.road = ROAD_Y.indexOf(ROAD_Y.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a)));
    car.lane = random() < 0.5 ? 1 : -1;
    car.dir = random() < 0.5 ? 1 : -1;
    car.angle = car.dir > 0 ? 0 : Math.PI;
    car.y = ROAD_Y[car.road] + car.lane * 24;
    car.x = range(random, 340, WORLD.width - 80);
  }
  car.cruise = range(random, 120, 200);
  car.speed = car.cruise;
  return car;
}

/** A parked car at the kerb of a random road: stealable, engine off. */
export function spawnParkedCar(random, city) {
  for (let tries = 0; tries < 12; tries += 1) {
    const p = randomRoadPoint(random);
    const vertical = random() < 0.5;
    const off = ROAD_W / 2 + 20;
    const x = vertical ? p.x + (random() < 0.5 ? off : -off) : p.x;
    const y = vertical ? p.y : p.y + (random() < 0.5 ? off : -off);
    if (x < 120 || x > WORLD.width - 30 || y < 30 || y > WORLD.height - 30) continue;
    if (hitsBuilding(city, x, y, 26)) continue;
    const car = makeCar(x, y, vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI), pick(random, CAR_COLORS), 'parked');
    car.speed = 0;
    return car;
  }
  return null;
}

/** Arcade driving: throttle, brake/reverse and steering from the input axes. */
export function driveCar(car, axes, dt, city) {
  const forward = axes.y < 0; // W / up: accelerate
  const back = axes.y > 0; // S / down: brake, then reverse
  const steer = axes.x; // A/D or arrows
  if (forward) car.speed += CAR.accel * dt;
  else if (back) {
    if (car.speed > 20) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    // Coast: gentle drag toward a stop.
    car.speed -= car.speed * CAR.drag * dt * 2;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  // Steering only bites while moving, and reverses when reversing.
  const moving = Math.abs(car.speed) > 12;
  if (moving) {
    const grip = Math.min(1, Math.abs(car.speed) / 160);
    car.angle += steer * CAR.steer * grip * dt * (car.speed >= 0 ? 1 : -1);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const resolved = collideCircle(city, nx, ny, CAR.length / 2 - 2);
  if (resolved.x !== nx || resolved.y !== ny) {
    // Bumped a wall: lose speed and stop dead rather than slide through it.
    car.speed *= 0.35;
    if (Math.abs(car.speed) > 200) car.health -= 2;
  }
  car.x = resolved.x;
  car.y = resolved.y;
}

/** A car chasing a point: steer toward it and floor it. Returns true if it rammed. */
export function chasePoint(car, tx, ty, dt, city, topSpeed) {
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  car.speed = Math.min(topSpeed, car.speed + CAR.accel * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const resolved = collideCircle(city, nx, ny, CAR.length / 2 - 2);
  if (resolved.x !== nx || resolved.y !== ny) car.speed *= 0.5;
  car.x = resolved.x;
  car.y = resolved.y;
  return dist < 40;
}

/** One traffic step: follow the road, slow for the car ahead, turn at intersections. */
export function updateTrafficCar(car, random, dt, cars) {
  const roadList = car.axis === 'v' ? ROAD_X : ROAD_Y;
  const crossList = car.axis === 'v' ? ROAD_Y : ROAD_X;
  const along = car.axis === 'v' ? car.y : car.x;
  // Car ahead in the same lane: slow down instead of rear-ending it.
  let ahead = Infinity;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    if (car.axis === 'v') {
      if (Math.abs(other.x - car.x) > 30) continue;
      const gap = (other.y - car.y) * car.dir;
      if (gap > 0 && gap < ahead) ahead = gap;
    } else {
      if (Math.abs(other.y - car.y) > 30) continue;
      const gap = (other.x - car.x) * car.dir;
      if (gap > 0 && gap < ahead) ahead = gap;
    }
  }
  let target = car.cruise;
  if (ahead < 90) target = ahead < 46 ? 0 : car.cruise * 0.3;
  car.speed += (target - car.speed) * Math.min(1, dt * 3);
  // Turn at an intersection, sometimes: switch onto the crossing road.
  const next = along + car.dir * car.speed * dt;
  for (let i = 0; i < crossList.length; i += 1) {
    const c = crossList[i];
    if ((along - c) * (next - c) > 0) continue;
    if (car.speed < 40 || random() >= 0.22) break;
    if (car.axis === 'v') {
      // Was heading north/south on ROAD_X[car.road]; now east/west on ROAD_Y[i].
      // x stays at the intersection column; y snaps to the new road's lane.
      car.axis = 'h';
      car.road = i;
      car.lane = random() < 0.5 ? 1 : -1;
      car.dir = random() < 0.5 ? 1 : -1;
      car.y = ROAD_Y[i] + car.lane * 24;
    } else {
      // Was heading east/west on ROAD_Y[car.road]; now north/south on ROAD_X[i].
      car.axis = 'v';
      car.road = i;
      car.lane = random() < 0.5 ? 1 : -1;
      car.dir = random() < 0.5 ? 1 : -1;
      car.x = ROAD_X[i] + car.lane * 24;
    }
    break;
  }
  // Move along the current road.
  if (car.axis === 'v') {
    car.x = ROAD_X[car.road] + car.lane * 24;
    car.y += car.dir * car.speed * dt;
    if (car.y < 60) { car.y = 60; car.dir = 1; car.angle = Math.PI / 2; }
    if (car.y > WORLD.height - 60) { car.y = WORLD.height - 60; car.dir = -1; car.angle = -Math.PI / 2; }
  } else {
    car.y = ROAD_Y[car.road] + car.lane * 24;
    car.x += car.dir * car.speed * dt;
    if (car.x < 330) { car.x = 330; car.dir = 1; car.angle = 0; }
    if (car.x > WORLD.width - 60) { car.x = WORLD.width - 60; car.dir = -1; car.angle = Math.PI; }
  }
  car.angle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
}

/** Distance between two cars' centres. */
export function carGap(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Keep cars from overlapping: push the pair apart and bleed speed. */
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d === 0 || d >= min) continue;
      const push = (min - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      a.x -= ux * push;
      a.y -= uy * push;
      b.x += ux * push;
      b.y += uy * push;
      a.speed *= 0.85;
      b.speed *= 0.85;
    }
  }
}
