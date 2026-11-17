// Save and load: progress, cash and mission state live in localStorage, so a
// visit later picks up where the last one left off. Nothing here ever throws:
// storage can be off, and the game then simply starts fresh each visit.

import { SAVE_KEY } from './config.js';

/** What is saved: cash, mission progress, the player's spot and health. */
export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      missionIndex: state.missionIndex,
      missionStep: state.missionStep,
      completed: state.completed,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      health: Math.round(state.player.health),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Apply a loaded save to a fresh state. */
export function applySave(state, data) {
  state.cash = data.cash;
  state.missionIndex = Math.min(data.missionIndex, 3);
  state.missionStep = data.missionStep || 0;
  state.completed = Array.isArray(data.completed) ? data.completed : [];
  state.player.x = data.x || state.player.x;
  state.player.y = data.y || state.player.y;
  state.player.health = data.health || 100;
}
