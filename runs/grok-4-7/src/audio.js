// Everything you hear is synthesised here. No samples.

const MELODY = [
  74, 0, 78, 0, 81, 0, 83, 78, 0, 0, 76, 0, 74, 0, 0, 0,
  81, 0, 83, 0, 86, 83, 0, 0, 78, 0, 76, 81, 74, 0, 0, 0,
];
const BASS = [50, 0, 0, 0, 57, 0, 0, 0, 52, 0, 0, 0, 49, 0, 0, 0];
const NIGHT = [
  73, 0, 76, 0, 80, 0, 82, 78, 0, 0, 75, 0, 73, 0, 0, 0,
  80, 0, 82, 0, 85, 82, 0, 0, 77, 0, 75, 80, 73, 0, 0, 0,
];

function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let airBus = null;
  let purrGain = null;
  let windGain = null;
  let nextNote = 0;
  let step = 0;
  let volume = 0.85;
  let muted = false;
  let lastStep = 0;
  let started = false;

  function applyGain() {
    if (!master) return;
    master.gain.value = muted ? 0 : volume;
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 2.2;
      comp.attack.value = 0.01;
      comp.release.value = 0.22;
      master.connect(comp);
      comp.connect(ctx.destination);

      musicBus = ctx.createGain();
      musicBus.gain.value = 0.34;
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.7;
      airBus = ctx.createGain();
      airBus.gain.value = 0.55;
      musicBus.connect(master);
      sfxBus.connect(master);
      airBus.connect(master);

      const seconds = 2;
      const noise = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
      const data = noise.getChannelData(0);
      let n = 0;
      for (let i = 0; i < data.length; i++) {
        n = (n + Math.random() * 2 - 1) * 0.5;
        data[i] = n;
      }

      const wind = ctx.createBufferSource();
      wind.buffer = noise;
      wind.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 420;
      windGain = ctx.createGain();
      windGain.gain.value = 0.07;
      wind.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(airBus);
      wind.start();

      const purrSrc = ctx.createBufferSource();
      purrSrc.buffer = noise;
      purrSrc.loop = true;
      const purrFilter = ctx.createBiquadFilter();
      purrFilter.type = 'lowpass';
      purrFilter.frequency.value = 140;
      const trem = ctx.createGain();
      trem.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 26;
      const lfoAmt = ctx.createGain();
      lfoAmt.gain.value = 0.35;
      const lfoOff = ctx.createConstantSource();
      lfoOff.offset.value = 0.6;
      lfo.connect(lfoAmt);
      lfoAmt.connect(trem.gain);
      lfoOff.connect(trem.gain);
      purrGain = ctx.createGain();
      purrGain.gain.value = 0;
      purrSrc.connect(purrFilter);
      purrFilter.connect(trem);
      trem.connect(purrGain);
      purrGain.connect(sfxBus);
      purrSrc.start();
      lfo.start();
      lfoOff.start();

      nextNote = ctx.currentTime + 0.05;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function resume() {
    if (!ensure()) return;
    started = true;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  function envGain(t, attack, peak, dur, dest) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest);
    return g;
  }

  function tone(t, hz, dur, peak, type, dest, slideTo) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(40, hz), t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    const g = envGain(t, Math.min(0.03, dur * 0.3), peak, dur, dest);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseBurst(t, dur, peak, freq, q, dest) {
    const seconds = 1;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = envGain(t, 0.005, peak, dur, dest);
    src.connect(filter);
    filter.connect(g);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function playMelody(t, midi, dur, peak) {
    tone(t, midiToHz(midi), dur, peak, 'sine', musicBus);
    tone(t, midiToHz(midi) * 2.01, dur * 0.7, peak * 0.18, 'triangle', musicBus);
  }

  function update(mood) {
    if (!ctx || !started) return;
    const now = ctx.currentTime;
    if (nextNote < now - 0.05) nextNote = now;
    const bpm = mood.night > 0.55 ? 60 : 72;
    const eighth = 60 / bpm / 2;
    let guard = 0;
    while (nextNote < now + 0.35 && guard < 6) {
      const i = step % MELODY.length;
      const line = mood.night > 0.5 ? NIGHT : MELODY;
      const note = line[i];
      const harmony = mood.comforts >= 3;
      if (note) {
        const peak = (0.045 + (harmony ? 0.012 : 0)) * (mood.ending ? 1.35 : 1);
        playMelody(nextNote, note, eighth * 1.6, peak);
        if (harmony && i % 2 === 0) {
          tone(nextNote, midiToHz(note + 7), eighth * 2.2, 0.018, 'sine', musicBus);
        }
      }
      const b = BASS[i % BASS.length];
      if (b) tone(nextNote, midiToHz(b), eighth * 3.2, 0.05, 'sine', musicBus, midiToHz(b) * 0.99);
      if (i % 8 === 0) {
        const root = mood.night > 0.5 ? 49 : 50;
        tone(nextNote, midiToHz(root + 7), eighth * 7, 0.02, 'sine', musicBus);
        tone(nextNote, midiToHz(root + 16), eighth * 7, 0.016, 'triangle', musicBus);
      }
      step += 1;
      nextNote += eighth;
      guard += 1;
    }
    const purrTarget = mood.purr || 0;
    if (purrGain) {
      const cur = purrGain.gain.value;
      purrGain.gain.value = cur + (purrTarget - cur) * 0.08;
    }
    if (windGain) windGain.gain.value = 0.045 + (mood.night || 0) * 0.03;
    if (musicBus) musicBus.gain.value = mood.paused ? 0.12 : mood.ending ? 0.42 : 0.32;
  }

  function chirp(pan) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan || 0));
    p.connect(airBus);
    const hz = 1600 + Math.random() * 700;
    tone(t, hz, 0.12, 0.025, 'sine', p, hz * 0.7);
    tone(t + 0.09, hz * 1.25, 0.08, 0.016, 'sine', p);
  }

  function meow(kind) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1300;
    filter.Q.value = 3.5;
    filter.connect(sfxBus);
    const o = ctx.createOscillator();
    o.type = 'sine';
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    let a = 620;
    let b = 420;
    let c = 540;
    if (kind === 'up') {
      a = 480; b = 760; c = 640;
    } else if (kind === 'tiny') {
      a = 700; b = 540; c = 620;
    }
    o.frequency.setValueAtTime(a, t);
    o.frequency.exponentialRampToValueAtTime(b, t + 0.14);
    o.frequency.exponentialRampToValueAtTime(c, t + 0.28);
    o2.frequency.setValueAtTime(a * 1.5, t);
    o2.frequency.exponentialRampToValueAtTime(c * 1.4, t + 0.28);
    const g = envGain(t, 0.03, kind === 'tiny' ? 0.05 : 0.07, 0.34, filter);
    const g2 = envGain(t, 0.03, 0.02, 0.3, filter);
    o.connect(g);
    o2.connect(g2);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.38);
    o2.stop(t + 0.38);
  }

  function footstep(surface) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    if (t - lastStep < 0.07) return;
    lastStep = t;
    const stone = surface === 'stone' || surface === 'wood';
    noiseBurst(t, stone ? 0.045 : 0.06, stone ? 0.05 : 0.035, stone ? 900 : 280, 0.7, sfxBus);
  }

  function jump() {
    if (!ctx || !started) return;
    noiseBurst(ctx.currentTime, 0.12, 0.04, 500, 0.6, sfxBus);
  }

  function land(hard) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    tone(t, hard ? 90 : 120, 0.12, hard ? 0.08 : 0.05, 'sine', sfxBus, 50);
    noiseBurst(t, 0.08, hard ? 0.06 : 0.03, 180, 0.5, sfxBus);
  }

  function collect() {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    tone(t, midiToHz(79), 0.4, 0.06, 'sine', sfxBus);
    tone(t + 0.06, midiToHz(83), 0.45, 0.05, 'sine', sfxBus);
    tone(t + 0.12, midiToHz(86), 0.55, 0.045, 'triangle', sfxBus);
  }

  function knock(kind) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    if (kind === 'metal') {
      tone(t, 520, 0.25, 0.05, 'triangle', sfxBus, 240);
      tone(t, 880, 0.18, 0.03, 'sine', sfxBus, 400);
    } else if (kind === 'yarn') {
      noiseBurst(t, 0.09, 0.04, 300, 1.2, sfxBus);
    } else {
      tone(t, 210, 0.16, 0.07, 'triangle', sfxBus, 80);
      noiseBurst(t, 0.1, 0.06, 1400, 0.8, sfxBus);
    }
  }

  function splash() {
    if (!ctx || !started) return;
    noiseBurst(ctx.currentTime, 0.28, 0.07, 700, 0.6, sfxBus);
  }

  function blip(up) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    tone(t, up ? 660 : 440, 0.09, 0.04, 'sine', sfxBus, up ? 880 : 330);
  }

  function collar() {
    if (!ctx || !started) return;
    tone(ctx.currentTime, 1760, 0.12, 0.025, 'sine', sfxBus, 1400);
  }

  function caw() {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 2;
    filter.connect(sfxBus);
    tone(t, 520, 0.14, 0.04, 'square', filter, 340);
    tone(t + 0.12, 480, 0.16, 0.035, 'square', filter, 300);
  }

  function endingChord(night) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    const root = night ? 70 : 74;
    for (const add of [0, 4, 7, 12]) {
      tone(t, midiToHz(root + add), 2.8, 0.04, 'sine', musicBus);
    }
  }

  return {
    resume,
    update,
    chirp,
    meow,
    footstep,
    jump,
    land,
    collect,
    knock,
    splash,
    blip,
    collar,
    caw,
    endingChord,
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      applyGain();
    },
    setMuted(m) {
      muted = m;
      applyGain();
    },
    get volume() { return volume; },
    get muted() { return muted; },
  };
}
