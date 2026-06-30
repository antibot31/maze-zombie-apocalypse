/*
 * sound.js — procedural sound effects via the Web Audio API (no audio files).
 * Public API: Sound.init(), Sound.toggleMute(), Sound.sfx.<name>()
 */
const Sound = (() => {
  let ctx = null, master = null, muted = false;

  // Must be called from a user gesture (e.g. the START click) to satisfy
  // browser autoplay policies.
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }

  function toggleMute() { muted = !muted; return muted; }

  // --- low-level voices ---------------------------------------------------
  function whiteNoise(dur) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // A pitched blip; optionally sweeps to `freqEnd`.
  function tone(type, freq, dur, vol, freqEnd) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + dur);
  }

  // A filtered noise burst (impacts, gunshots, etc.).
  function noise(dur, vol, filterFreq, filterType) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = whiteNoise(dur);
    const gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    filter.type = filterType || 'lowpass';
    filter.frequency.value = filterFreq || 1000;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t); src.stop(t + dur);
  }

  // --- named effects ------------------------------------------------------
  const sfx = {
    shoot()      { noise(0.09, 0.45, 2200, 'highpass'); tone('square', 240, 0.09, 0.18, 70); },
    hit()        { noise(0.05, 0.25, 800); },
    zombieDead() { tone('sawtooth', 200, 0.38, 0.3, 45); noise(0.3, 0.18, 500); },
    hurt()       { tone('square', 180, 0.22, 0.32, 60); noise(0.12, 0.2, 700); },
    reload()     { noise(0.03, 0.22, 3000, 'bandpass');
                   setTimeout(() => noise(0.03, 0.22, 2200, 'bandpass'), 450); },
    empty()      { tone('square', 120, 0.05, 0.12, 90); },
    wave()       { tone('triangle', 300, 0.35, 0.25, 680); },
    levelUp()    { [523, 659, 784, 1047].forEach((f, i) =>
                     setTimeout(() => tone('triangle', f, 0.18, 0.28), i * 80)); },
    pickup()     { [660, 880, 1175].forEach((f, i) =>
                     setTimeout(() => tone('square', f, 0.12, 0.22), i * 60)); },
    gameOver()   { [330, 262, 196, 131].forEach((f, i) =>
                     setTimeout(() => tone('sawtooth', f, 0.4, 0.3), i * 180)); },
  };

  return { init, toggleMute, sfx };
})();
