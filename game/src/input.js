// Keyboard and mouse input. Held keys give a movement direction; one-shot presses
// (interact, pause, confirm, punch) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The mouse aims
// the gun and fires it; its position is kept in screen pixels for the renderer to map.

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_PUNCH = 8;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const INTERACT = new Set(['KeyE']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CONFIRM = new Set(['Space', 'Enter']);
const PUNCH = new Set(['KeyF', 'KeyQ']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, shift: false };
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  function press(code) {
    if (UP.has(code)) held.up = true;
    else if (DOWN.has(code)) held.down = true;
    else if (LEFT.has(code)) held.left = true;
    else if (RIGHT.has(code)) held.right = true;
    else if (code === 'ShiftLeft' || code === 'ShiftRight') held.shift = true;
    else if (INTERACT.has(code)) actions |= ACTION_INTERACT;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PUNCH.has(code)) actions |= ACTION_PUNCH;
    else return false;
    return true;
  }

  function release(code) {
    if (UP.has(code)) held.up = false;
    else if (DOWN.has(code)) held.down = false;
    else if (LEFT.has(code)) held.left = false;
    else if (RIGHT.has(code)) held.right = false;
    else if (code === 'ShiftLeft' || code === 'ShiftRight') held.shift = false;
  }

  window.addEventListener('keydown', (event) => {
    if (press(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => release(event.code));
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.shift = false;
    mouse.down = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    held,
    mouse,
    /** -1/0/1 for each axis from the keys held now. */
    axes() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** A plain snapshot the update step reads (used by the real loop and by shots). */
    snapshot() {
      return {
        axes: this.axes(),
        shift: held.shift,
        mouseX: mouse.x,
        mouseY: mouse.y,
        mouseDown: mouse.down,
        actions: this.takeActions(),
      };
    },
  };
}
