// Drawing only: the city, its cars and people, and the menu screens — state in,
// pixels out. The 1280x720 view is scaled to fit the window and centred; the
// camera's top-left corner and the scale together map world points to the screen.

import { BEACH, FONT, PALETTE, ROAD_W, ROAD_X, ROAD_Y, VIEW, WORLD } from './config.js';
import { districtAt } from './world.js';
import { missionMarker } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const PANEL = { width: 640, top: 150, line: 32, bottom: 78 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.ox = (width - VIEW.width * view.scale) / 2;
    view.oy = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  /** World point to screen point, in logical 1280x720 space. */
  function toScreen(wx, wy, cam) {
    return { x: wx - cam.x, y: wy - cam.y };
  }

  function drawGround(state, cam) {
    const x0 = Math.max(0, cam.x - 40);
    const y0 = Math.max(0, cam.y - 40);
    const x1 = Math.min(WORLD.width, cam.x + VIEW.width + 40);
    const y1 = Math.min(WORLD.height, cam.y + VIEW.height + 40);
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Sea and sand on the west edge.
    context.fillStyle = PALETTE.seaDeep;
    context.fillRect(0, y0, BEACH.waterTo, y1 - y0);
    context.fillStyle = PALETTE.sea;
    context.fillRect(BEACH.waterTo, y0, 26, y1 - y0);
    context.fillStyle = PALETTE.sand;
    context.fillRect(BEACH.waterTo + 26, y0, BEACH.sandTo - BEACH.waterTo - 26, y1 - y0);
    // Parks.
    context.fillStyle = PALETTE.park;
    for (const park of state.city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    // Sidewalk aprons around every road, then the roads themselves.
    context.fillStyle = PALETTE.sidewalk;
    for (const cx of ROAD_X) context.fillRect(cx - ROAD_W / 2 - 12, y0, ROAD_W + 24, y1 - y0);
    for (const cy of ROAD_Y) context.fillRect(x0, cy - ROAD_W / 2 - 12, x1 - x0, ROAD_W + 24);
    context.fillStyle = PALETTE.road;
    for (const cx of ROAD_X) context.fillRect(cx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    for (const cy of ROAD_Y) context.fillRect(x0, cy - ROAD_W / 2, x1 - x0, ROAD_W);
    // Dashed centre lines.
    context.fillStyle = PALETTE.lane;
    for (const cx of ROAD_X) {
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) {
        context.fillRect(cx - 2, y, 4, 22);
      }
    }
    for (const cy of ROAD_Y) {
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) {
        context.fillRect(x, cy - 2, 22, 4);
      }
    }
    // District name tags, drawn on the ground.
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    const tags = [
      { x: 1700, y: 1150, name: 'DOWNTOWN', size: 34 },
      { x: 170, y: 1300, name: 'SUNSET BEACH', size: 26 },
      { x: 2850, y: 2150, name: 'CORAL DOCKS', size: 28 },
      { x: 1700, y: 350, name: 'NORTHGATE', size: 26 },
    ];
    for (const tag of tags) {
      if (tag.x < x0 - 200 || tag.x > x1 + 200 || tag.y < y0 - 100 || tag.y > y1 + 100) continue;
      text(tag.name, tag.x, tag.y, tag.size, 'rgba(255,255,255,0.26)', 'center');
    }
  }

  function drawBuildings(state, cam) {
    const x0 = cam.x - 60;
    const y0 = cam.y - 60;
    const x1 = cam.x + VIEW.width + 60;
    const y1 = cam.y + VIEW.height + 60;
    for (const b of state.city.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      // A soft shadow to the south-east gives the blocks height.
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      if (b.kind === 'tower' && b.tall) {
        // Rooftop inset: taller towers read as towers.
        context.fillStyle = b.roof;
        context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
        context.fillStyle = b.color;
        context.fillRect(b.x + 14, b.y + 14, b.w - 28, b.h - 28);
      } else if (b.roof) {
        context.fillStyle = b.roof;
        context.fillRect(b.x, b.y, b.w, 10);
      }
      if (b.kind === 'container') {
        context.fillStyle = 'rgba(0,0,0,0.25)';
        for (let i = 1; i < 4; i += 1) context.fillRect(b.x + (b.w / 4) * i - 1, b.y, 2, b.h);
      }
      // Windows on the bigger blocks.
      if (b.w > 70 && b.h > 60 && b.kind !== 'warehouse' && b.kind !== 'container') {
        context.fillStyle = 'rgba(255,255,255,0.35)';
        for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 22) {
          for (let wy = b.y + 12; wy < b.y + b.h - 12; wy += 24) {
            context.fillRect(wx, wy, 10, 12);
          }
        }
      }
    }
    // Trees: a trunk dot and a leafy crown.
    for (const t of state.city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      context.fillStyle = '#4f7a3a';
      context.beginPath();
      context.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#6db85a';
      context.beginPath();
      context.arc(t.x - 2, t.y - 2, t.r - 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCarShape(car, flash) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const halfL = 23;
    const halfW = 11;
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(-halfL + 3, -halfW + 4, halfL * 2, halfW * 2);
    context.fillStyle = car.dead ? '#3a3a3a' : car.color;
    context.beginPath();
    context.roundRect(-halfL, -halfW, halfL * 2, halfW * 2, 6);
    context.fill();
    // Cabin and windshield.
    context.fillStyle = car.dead ? '#222' : 'rgba(20,28,40,0.75)';
    context.beginPath();
    context.roundRect(-6, -halfW + 3, 16, halfW * 2 - 6, 4);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.5)';
    context.fillRect(8, -halfW + 4, 3, halfW * 2 - 8);
    if (car.kind === 'police') {
      context.fillStyle = '#ffffff';
      context.fillRect(-halfL + 4, -halfW, halfL * 2 - 8, 5);
      // Light bar, flashing red and blue.
      context.fillStyle = flash ? '#ff2d2d' : '#2d5fff';
      context.fillRect(-4, -halfW - 1, 8, 4);
      context.fillStyle = flash ? '#2d5fff' : '#ff2d2d';
      context.fillRect(-4, halfW - 3, 8, 4);
      text('CBPD', 0, 4, 9, '#1c2430', 'center');
    }
    if (car.kind === 'stolen') {
      text('★', -14, 4, 10, PALETTE.gold, 'center');
    }
    // Wheels.
    context.fillStyle = '#16181c';
    context.fillRect(-halfL + 4, -halfW - 2, 8, 4);
    context.fillRect(-halfL + 4, halfW - 2, 8, 4);
    context.fillRect(halfL - 12, -halfW - 2, 8, 4);
    context.fillRect(halfL - 12, halfW - 2, 8, 4);
    context.restore();
    if (car.smoke > 0) {
      context.fillStyle = 'rgba(120,120,120,0.55)';
      for (let i = 0; i < 3; i += 1) {
        const a = (stateTime * 0.7 + i * 2.1) % 1;
        context.beginPath();
        context.arc(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20 - a * 26, 6 + a * 10, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  let stateTime = 0;

  function drawPerson(x, y, angle, shirt, skin, bob, aiming) {
    context.save();
    context.translate(x, y);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(0, 6, 11, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.rotate(angle);
    const sway = Math.sin(bob) * 1.5;
    // Body and head, top-down.
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = skin;
    context.beginPath();
    context.arc(4, sway, 6, 0, Math.PI * 2);
    context.fill();
    if (aiming) {
      context.strokeStyle = '#1c2430';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(8, 0);
      context.lineTo(20, 0);
      context.stroke();
    }
    context.restore();
  }

  function drawWorld(state, cam) {
    drawGround(state, cam);
    drawBuildings(state, cam);
    // Cash packages: bobbing gold pouches.
    for (const pkg of state.packages) {
      if (pkg.got) continue;
      const bob = Math.sin(state.time * 3 + pkg.bob) * 3;
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(pkg.x, pkg.y + bob, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7a5a00';
      text('$', pkg.x, pkg.y + bob + 4, 12, '#7a5a00', 'center');
    }
    // Mission marker: a pulsing beacon at the target.
    const marker = missionMarker(state);
    if (marker) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.15;
      context.save();
      context.translate(marker.x, marker.y);
      context.fillStyle = 'rgba(255,210,62,0.25)';
      context.beginPath();
      context.arc(0, 0, 46 * pulse, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, 0, 30 * pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.moveTo(0, -14);
      context.lineTo(10, 0);
      context.lineTo(0, 14);
      context.lineTo(-10, 0);
      context.closePath();
      context.fill();
      context.restore();
    }
    // Taxi destination marker.
    if (state.taxi) {
      const d = state.taxi.dest;
      context.fillStyle = 'rgba(88,214,141,0.3)';
      context.beginPath();
      context.arc(d.x, d.y, 40, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#58d68d';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(d.x, d.y, 28, 0, Math.PI * 2);
      context.stroke();
      text('TAXI', d.x, d.y - 34, 14, '#58d68d', 'center');
    }
    // Cars: parked and traffic first, then police, then the player's car on top.
    const flash = Math.floor(state.time * 4) % 2 === 0;
    for (const car of state.traffic) if (!car.dead) drawCarShape(car, flash);
    for (const car of state.parked) if (!car.dead) drawCarShape(car, flash);
    for (const car of state.policeCars) drawCarShape(car, flash);
    if (state.player.car) drawCarShape(state.player.car, flash);
    // Pedestrians and cops.
    for (const ped of state.peds) {
      if (ped.dead) {
        context.fillStyle = 'rgba(0,0,0,0.3)';
        context.beginPath();
        context.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.bob, false);
      if (ped.state === 'taxi') {
        text('$', ped.x, ped.y - 18, 14, '#58d68d', 'center');
        context.fillStyle = '#58d68d';
        context.beginPath();
        context.arc(ped.x, ped.y - 24, 8, 0, Math.PI * 2);
        context.fill();
        text('$', ped.x, ped.y - 20, 11, '#0c1e12', 'center');
      }
    }
    for (const cop of state.cops) {
      if (cop.dead) continue;
      drawPerson(cop.x, cop.y, cop.angle, '#1d3f8a', '#e8c39a', cop.bob, false);
      text('👮', cop.x, cop.y - 18, 12, '#ffffff', 'center');
    }
    // The player, on foot.
    const p = state.player;
    if (p.onFoot) {
      const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 8) % 2 === 0;
      if (!blink) drawPerson(p.x, p.y, p.aimAngle || p.angle, '#e5534b', '#e8c39a', state.time * 10, true);
      // Aim line, short and subtle.
      context.strokeStyle = 'rgba(255,255,255,0.35)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(p.x + Math.cos(p.aimAngle) * 46, p.y + Math.sin(p.aimAngle) * 46);
      context.stroke();
    }
    // Bullets.
    context.fillStyle = '#ffe27a';
    for (const b of state.bullets) {
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Particles.
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(x, y, PANEL.width, height, 12);
    context.fill();
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 72, 44, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 36, 22, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'Danny Cole is back in Coral Bay — broke, and out of options.',
    'Steal cars, outrun the CBPD, and run three jobs for Mara Voss.',
    'WASD / arrows — move & drive · E — steal / get out · Click — shoot · F — punch',
    'P — pause · Missions pay cash · Taxi fares and $ packages pay too',
    '',
  ];

  /** Paint one frame: the world, then the screen's overlay. */
  function draw(state, screen, extra) {
    stateTime = state.time;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0c1220';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    // The world is drawn in camera space: shift by the camera, then draw world coords.
    context.save();
    context.translate(-state.camera.x, -state.camera.y);
    drawWorld(state, state.camera);
    context.restore();
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = extra.save ? `Save found: $${extra.save.cash} — press C to continue, or Space to start fresh` : 'No save yet — your progress saves automatically';
      drawPanel('CORAL BAY', ['HEAT RISING', ...TITLE_LINES], extra.save ? 'Space — new game · C — continue' : 'Press Space or click to start');
      return;
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits for you.', 'S — save now · Space — resume'], 'Press P or Space to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The CBPD caught up with Danny.', 'Hospital bill: -$100 · Mission progress kept'], 'Press Space to get back on the street');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Danny went down in Coral Bay.', 'Hospital bill: -$100 · Mission progress kept'], 'Press Space to get back on the street');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view, toScreen };
}
