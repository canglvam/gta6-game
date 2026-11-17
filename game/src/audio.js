// Sound, synthesized live with WebAudio: no audio files, nothing over the network.
// An engine hum that follows the car's speed, a two-tone police siren while wanted,
// and short blips for shots, pickups and mission results. Everything is guarded:
// audio starts on the first key or click and never throws if it cannot.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenPhase = 0;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  /** A short tone: frequency slides from `from` to `to` over `seconds`. */
  function blip(from, to, seconds, volume, type) {
    if (!ensure() || !ctx) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(from, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + seconds);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + seconds + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  /** A burst of noise: the gunshot. */
  function noise(seconds, volume) {
    if (!ensure() || !ctx) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {
      // See blip.
    }
  }

  return {
    /** Call on any key or click: unlocks the audio context. */
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    },
    /** Per-frame: engine pitch from speed, siren wail while wanted. */
    update(speed, wanted, dt) {
      if (!ctx) return;
      try {
        if (engineOsc && engineGain) {
          const driving = Math.abs(speed) > 20;
          engineGain.gain.value = driving ? 0.035 : 0;
          engineOsc.frequency.value = 55 + Math.abs(speed) * 0.16;
        }
        if (sirenOsc && sirenGain) {
          if (wanted > 0) {
            sirenTimer -= dt;
            if (sirenTimer <= 0) {
              sirenTimer = 0.45;
              sirenPhase = sirenPhase === 0 ? 1 : 0;
              sirenOsc.frequency.value = sirenPhase === 0 ? 720 : 960;
            }
            sirenGain.gain.value = 0.018;
          } else {
            sirenGain.gain.value = 0;
          }
        }
      } catch {
        // See blip.
      }
    },
    shot() { noise(0.12, 0.25); },
    copShot() { noise(0.1, 0.12); },
    punch() { noise(0.07, 0.18); },
    pickup() { blip(880, 1320, 0.12, 0.15, 'sine'); },
    coin() { blip(660, 990, 0.1, 0.12, 'sine'); },
    steal() { blip(220, 440, 0.18, 0.15, 'triangle'); },
    thud() { noise(0.15, 0.2); },
    mission() {
      blip(523, 523, 0.12, 0.15, 'triangle');
      setTimeout(() => blip(659, 659, 0.12, 0.15, 'triangle'), 120);
      setTimeout(() => blip(784, 784, 0.22, 0.15, 'triangle'), 240);
    },
  };
}
