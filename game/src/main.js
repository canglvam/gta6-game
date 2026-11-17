// Coral Bay: Heat Rising — boot and the one loop. Input is read every frame, the
// game advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between five
// screens: title, play, paused, busted and wasted.
//
// ?seed=N fixes the city. ?shot=chase|driving|mission|city (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createGame, respawn, updateGame } from './state.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { applySave, clearSave, loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
let state = createGame(seed);
const renderer = createRenderer(canvas);
const hud = createHud();
const audio = createAudio();
let savedGame = loadSave();

/** A burst of particles at a point (sparks, smoke, pickup glitter). */
function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    state.particles.push({
      x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
      life: 0.5 + Math.random() * 0.3, maxLife: 0.8, color, size: 2 + Math.random() * 3,
    });
  }
}

/** What the game does with each event the update step reported. */
function handleEvents() {
  for (const event of state.events) {
    if (event.type === 'shot') {
      audio.shot();
      burst(state.player.x + Math.cos(state.player.aimAngle) * 24, state.player.y + Math.sin(state.player.aimAngle) * 24, '#ffe27a', 4, 120);
    } else if (event.type === 'copShot') audio.copShot();
    else if (event.type === 'punch') audio.punch();
    else if (event.type === 'package') { audio.pickup(); burst(state.player.x, state.player.y, '#f2c94c', 10, 140); }
    else if (event.type === 'taxiPaid') audio.coin();
    else if (event.type === 'taxiStart') audio.coin();
    else if (event.type === 'missionComplete') { audio.mission(); saveGame(state); }
    else if (event.type === 'save') saveGame(state);
    else if (event.type === 'steal') audio.steal();
    else if (event.type === 'thud') audio.thud();
    else if (event.type === 'carWrecked') {
      audio.thud();
      burst(event.car.x, event.car.y, '#888888', 18, 180);
      burst(event.car.x, event.car.y, '#ff9a3d', 12, 220);
    }
  }
  state.events.length = 0;
}

function runShot(name) {
  const scene = stageShot(name, state);
  window.__game = { state, screen: scene.screen };
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, {});
    hud.draw(canvas.getContext('2d'), state);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startFresh() {
    state = createGame(Math.floor(Math.random() * 4294967296));
    clearSave();
    savedGame = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal a car and get to the docks.');
  }

  function startContinued() {
    savedGame = loadSave();
    if (!savedGame) return;
    applySave(state, savedGame);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Continued. Welcome back to Coral Bay.');
  }

  function endRun(over) {
    screen = over === 'busted' ? SCREEN_BUSTED : SCREEN_WASTED;
    saveGame(state);
    announce(over === 'busted' ? 'Busted. The police caught Danny.' : 'Wasted. Danny went down.');
  }

  // Continue with C on the title screen.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && screen === SCREEN_TITLE && savedGame) startContinued();
    if (event.code === 'KeyS' && screen === SCREEN_PAUSED) {
      if (saveGame(state)) announce('Saved.');
    }
  });

  function step(snap) {
    updateGame(state, snap, STEP);
    handleEvents();
    if (state.over) endRun(state.over);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const snap = input.snapshot();
    // Mouse position in CSS pixels to world coordinates.
    const dpr = window.devicePixelRatio || 1;
    snap.mouseWorld = {
      x: state.camera.x + (snap.mouseX * dpr - renderer.view.ox) / renderer.view.scale,
      y: state.camera.y + (snap.mouseY * dpr - renderer.view.oy) / renderer.view.scale,
    };
    audio.unlock();
    if (screen === SCREEN_TITLE) {
      if (snap.actions & ACTION_CONFIRM) startFresh();
    } else if (screen === SCREEN_PLAY) {
      if (snap.actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        saveGame(state);
        announce('Paused. Progress saved.');
      } else {
        let steps = 0;
        while (accumulator >= STEP && steps < 5) {
          step(snap);
          accumulator -= STEP;
          steps += 1;
          snap.actions = 0; // one-shot presses count once per frame, not once per step
          if (screen !== SCREEN_PLAY) break;
        }
        if (accumulator >= STEP) accumulator = 0;
      }
    } else if (screen === SCREEN_PAUSED) {
      accumulator = 0;
      if (snap.actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      accumulator = 0;
      if (snap.actions & ACTION_CONFIRM) {
        respawn(state);
        accumulator = 0;
        screen = SCREEN_PLAY;
        announce('Back on the street.');
      }
    }
    if (screen === SCREEN_PLAY) {
      const speed = state.player.car ? Math.abs(state.player.car.speed) : 0;
      audio.update(speed, state.wanted, STEP);
    } else {
      audio.update(0, 0, STEP);
    }
    renderer.draw(state, screen, { save: savedGame });
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      hud.draw(canvas.getContext('2d'), state);
    }
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused. Progress saved.');
    }
  });

  // For play-testing and debugging from the console.
  window.__game = { get state() { return state; }, get screen() { return screen; } };
  window.__respawn = () => respawn(state);

  announce('Coral Bay: Heat Rising. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
