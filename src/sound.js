/*
 * sound.js — procedural sound effects via the Web Audio API (no audio files).
 * Public API: Sound.init(), Sound.toggleMute(), Sound.sfx.<name>()
 */
const Sound = (() => {
  let ctx = null, master = null, muted = false;

  const MUSIC_VOL = 0.22;             // overall ambience level
  let musicGain = null, musicOn = false, musicNodes = [], dripTimeout = null;

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

  function toggleMute() {
    muted = !muted;
    if (musicGain) musicGain.gain.setTargetAtTime(muted ? 0 : MUSIC_VOL, ctx.currentTime, 0.1);
    return muted;
  }

  // --- cave ambience (background music) -----------------------------------
  // A low detuned drone that slowly breathes, plus echoing water drips.
  function startMusic() {
    if (!ctx || musicOn) return;
    musicOn = true;
    const t = ctx.currentTime;

    musicGain = ctx.createGain();
    musicGain.gain.value = muted ? 0 : MUSIC_VOL;
    musicGain.connect(master);

    // Cavernous echo bus (delay with feedback) for the drips.
    const echo = ctx.createDelay(1.0);
    echo.delayTime.value = 0.34;
    const feedback = ctx.createGain(); feedback.gain.value = 0.42;
    const echoTone = ctx.createBiquadFilter(); echoTone.type = 'lowpass'; echoTone.frequency.value = 1400;
    echo.connect(echoTone); echoTone.connect(feedback); feedback.connect(echo);
    echo.connect(musicGain);

    // Drone: a couple of slightly detuned low voices through a soft lowpass.
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass'; droneFilter.frequency.value = 320;
    droneFilter.connect(musicGain);
    const droneGain = ctx.createGain(); droneGain.gain.value = 0; droneGain.connect(droneFilter);
    droneGain.gain.linearRampToValueAtTime(0.5, t + 4); // slow fade-in

    [55, 55.4, 82.5].forEach(freq => {     // A1, slightly detuned A1, and a fifth
      const o = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = freq;
      o.connect(droneGain); o.start(t); musicNodes.push(o);
    });

    // Slow LFO breathing the drone's filter open and shut.
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 140;
    lfo.connect(lfoDepth); lfoDepth.connect(droneFilter.frequency);
    lfo.start(t); musicNodes.push(lfo);

    musicNodes.push(droneGain, echo); // kept so stopMusic can release them
    scheduleDrip(echo);
  }

  // A single water drip: short sine "plink" sent mostly into the echo bus.
  function scheduleDrip(echo) {
    if (!musicOn) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    o.type = 'sine';
    const f = 500 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    pan.pan.value = Math.random() * 2 - 1;
    o.connect(g); g.connect(pan); pan.connect(echo);
    o.start(t); o.stop(t + 0.2);

    dripTimeout = setTimeout(() => scheduleDrip(echo), 2500 + Math.random() * 5000);
  }

  function stopMusic() {
    if (!musicOn) return;
    musicOn = false;
    if (dripTimeout) { clearTimeout(dripTimeout); dripTimeout = null; }
    musicNodes.forEach(n => { try { n.stop && n.stop(); n.disconnect(); } catch (e) {} });
    musicNodes = [];
    if (musicGain) { musicGain.disconnect(); musicGain = null; }
  }

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

  return { init, toggleMute, startMusic, stopMusic, sfx };
})();
