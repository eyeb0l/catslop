// Every sound is synthesised here with Web Audio: meows, purring, paws, water,
// insects, birds, and a small generative tune. No audio files exist.
import { clamp, lerp, rand, pick } from './util.js';

const DAY_SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
const NIGHT_SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

export class Sound {
  constructor() {
    this.ctx = null;
    this.volume = 0.8; this.musicOn = true;
    this.nextNote = 0; this.melody = 4; this.nextBird = 3; this.nextCricket = 0; this.nextBass = 0;
    this.purrGain = null; this.purrTarget = 0;
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0.5; this.amb.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.22;
    // A feedback delay gives the tune some air.
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.36;
    const fb = ctx.createGain(); fb.gain.value = 0.36;
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    this.music.connect(this.master); this.music.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Continuous beds: wind, sea, purr.
    this.wind = this.loopNoise('lowpass', 420, 0.6, this.amb, 0);
    this.sea = this.loopNoise('bandpass', 520, 0.5, this.amb, 0);
    const purr = this.loopNoise('lowpass', 190, 2.5, this.sfx, 0);
    const lfo = ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = 25;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0;
    lfo.connect(lfoGain); lfoGain.connect(purr.gain.gain); lfo.start();
    this.purrGain = purr.gain; this.purrLfo = lfoGain;
  }

  loopNoise(type, freq, q, dest, vol) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = ctx.createGain(); gain.gain.value = vol;
    src.connect(filter); filter.connect(gain); gain.connect(dest); src.start();
    return { src, filter, gain };
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMusic(on) { this.musicOn = on; }

  tone({ type = 'sine', f0, f1 = f0, f2, dur = 0.2, vol = 0.2, attack = 0.008, at = 0, dest }) {
    if (!this.ctx || vol < 0.0005) return;
    const ctx = this.ctx, t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f2) { o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.4); o.frequency.exponentialRampToValueAtTime(f2, t + dur); } else o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.03);
  }

  noise({ type = 'bandpass', f0 = 1000, f1 = f0, q = 1, dur = 0.2, vol = 0.2, attack = 0.005, at = 0, dest }) {
    if (!this.ctx || vol < 0.0005) return;
    const ctx = this.ctx, t = ctx.currentTime + at;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.03);
  }

  // ---- The cat ----------------------------------------------------------------------
  meow(mood = 'meow') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const p = rand(0.92, 1.12);
    const shapes = {
      meow: { dur: rand(0.5, 0.7), f: [520, 790, 430], vol: 0.3 },
      mrrp: { dur: 0.2, f: [480, 760, 900], vol: 0.22 },
      yelp: { dur: 0.28, f: [900, 1250, 600], vol: 0.3 },
      demand: { dur: 0.85, f: [460, 700, 380], vol: 0.32 },
    };
    const s = shapes[mood] || shapes.meow;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(s.f[0] * p, t);
    o.frequency.linearRampToValueAtTime(s.f[1] * p, t + s.dur * 0.3);
    o.frequency.linearRampToValueAtTime(s.f[2] * p, t + s.dur);
    const vib = ctx.createOscillator(); vib.frequency.value = 6.5;
    const vg = ctx.createGain(); vg.gain.value = 9; vib.connect(vg); vg.connect(o.frequency);
    // Two moving formants turn a buzz into something like "mee-ow".
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5;
    f1.frequency.setValueAtTime(900, t); f1.frequency.linearRampToValueAtTime(1900, t + s.dur * 0.3); f1.frequency.linearRampToValueAtTime(700, t + s.dur);
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 6;
    f2.frequency.setValueAtTime(2600, t); f2.frequency.linearRampToValueAtTime(3300, t + s.dur * 0.3); f2.frequency.linearRampToValueAtTime(2200, t + s.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(s.vol, t + 0.05);
    g.gain.setValueAtTime(s.vol, t + s.dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.45;
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g2); g2.connect(g); g.connect(this.sfx);
    o.start(t); vib.start(t); o.stop(t + s.dur + 0.05); vib.stop(t + s.dur + 0.05);
  }
  setPurr(amount) { this.purrTarget = amount; }

  step(sp, surface) {
    const v = clamp(0.012 + sp * 0.006, 0, 0.05);
    if (surface === 'wood') { this.tone({ type: 'triangle', f0: rand(150, 190), f1: 90, dur: 0.07, vol: v * 2.2 }); this.noise({ type: 'lowpass', f0: 700, dur: 0.04, vol: v }); } else if (surface === 'water') this.noise({ type: 'bandpass', f0: rand(1400, 2200), f1: 700, q: 0.8, dur: 0.12, vol: v * 2.4 });
    else if (surface === 'sand') this.noise({ type: 'bandpass', f0: rand(1800, 2600), q: 0.6, dur: 0.07, vol: v * 1.1 });
    else this.noise({ type: 'bandpass', f0: rand(2500, 4200), q: 0.7, dur: 0.05, vol: v });
  }
  whoosh(power) { this.noise({ type: 'bandpass', f0: 500, f1: 2200 + power * 1500, q: 1.2, dur: 0.22 + power * 0.14, vol: 0.12 + power * 0.1 }); }
  land(strength) { this.tone({ f0: 150, f1: 55, dur: 0.14, vol: 0.12 + strength * 0.22 }); this.noise({ type: 'lowpass', f0: 900, f1: 200, dur: 0.1, vol: 0.05 + strength * 0.1 }); }
  splash(strength) {
    this.noise({ type: 'highpass', f0: 700, f1: 2500, q: 0.4, dur: 0.45 + strength * 0.4, vol: 0.14 + strength * 0.22 });
    this.noise({ type: 'lowpass', f0: 500, f1: 90, dur: 0.3, vol: 0.2 * strength + 0.05 });
  }
  shake() { for (let i = 0; i < 7; i++) this.noise({ type: 'bandpass', f0: rand(2000, 5000), q: 1, dur: 0.07, vol: 0.09, at: i * 0.1 }); }
  rustle() { this.noise({ type: 'bandpass', f0: rand(3000, 5000), f1: 2000, q: 0.5, dur: 0.18, vol: 0.035 }); }

  // ---- Rewards and UI --------------------------------------------------------------------
  catch(first) {
    const notes = first ? [659.25, 783.99, 987.77, 1318.5, 1567.98] : [659.25, 880, 1318.5];
    notes.forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.22, vol: 0.16, at: i * 0.07 }));
    this.meow('mrrp');
  }
  coins(n) { for (let i = 0; i < Math.min(n, 9); i++) this.tone({ type: 'sine', f0: 1320 + (i % 3) * 220, f1: 1760 + (i % 3) * 220, dur: 0.08, vol: 0.09, at: 0.15 + i * 0.055 }); }
  deliver() { [392, 523.25, 659.25].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.14, at: i * 0.09 })); }
  click() { this.tone({ type: 'triangle', f0: 880, f1: 660, dur: 0.05, vol: 0.08 }); }
  buy() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.14, at: i * 0.06 })); this.bell(0.3); }
  nope() { this.tone({ type: 'square', f0: 180, f1: 120, dur: 0.16, vol: 0.07 }); }
  bell(at = 0) { this.tone({ f0: 2637, dur: 0.5, vol: 0.07, at }); this.tone({ f0: 3951, dur: 0.3, vol: 0.035, at }); }
  fanfare() { [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: i === 6 ? 0.9 : 0.24, vol: 0.18, at: i * 0.16 })); }
  paper() { this.noise({ type: 'bandpass', f0: 3200, f1: 1500, q: 0.6, dur: 0.16, vol: 0.06 }); }
  laugh() { for (let i = 0; i < 4; i++) this.tone({ type: 'sawtooth', f0: 240 - i * 14, f1: 170, dur: 0.11, vol: 0.05, at: i * 0.15 }); }
  flap() { for (let i = 0; i < 5; i++) this.noise({ type: 'bandpass', f0: 900, q: 0.8, dur: 0.05, vol: 0.07, at: i * 0.06 }); }
  canOpen() { this.noise({ type: 'highpass', f0: 3000, dur: 0.12, vol: 0.12 }); this.tone({ type: 'square', f0: 900, f1: 300, dur: 0.1, vol: 0.06, at: 0.1 }); }

  // ---- Animals: v is 0..1 loudness from distance ---------------------------------------------
  croak(v) { for (let i = 0; i < 2; i++) this.tone({ type: 'sawtooth', f0: 150, f1: 95, dur: 0.16, vol: 0.09 * v, at: i * 0.22 }); }
  squeak(v) { this.tone({ f0: 3100, f1: 4300, dur: 0.07, vol: 0.09 * v }); this.tone({ f0: 3500, f1: 4500, dur: 0.06, vol: 0.07 * v, at: 0.1 }); }
  chirp(v) {
    const base = rand(2400, 3600), n = (rand(2, 5)) | 0;
    for (let i = 0; i < n; i++) this.tone({ f0: base, f1: base * rand(1.15, 1.45), f2: base * 0.95, dur: 0.09, vol: 0.035 * v, at: i * 0.12, dest: this.amb });
  }
  plop(v) { this.tone({ f0: 500, f1: 160, dur: 0.1, vol: 0.12 * v }); this.noise({ type: 'highpass', f0: 1500, dur: 0.15, vol: 0.06 * v }); }
  snip(v) { this.noise({ type: 'highpass', f0: 4000, dur: 0.03, vol: 0.2 * v }); this.noise({ type: 'highpass', f0: 4000, dur: 0.03, vol: 0.2 * v, at: 0.08 }); }

  /** Ambience and music, driven by where the cat is and what time it is. */
  update(dt, { night, coast, pond, speed, happy, paused }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    this.wind.gain.gain.setTargetAtTime(0.05 + Math.sin(t * 0.21) * 0.025 + clamp(speed / 10) * 0.05, t, 0.4);
    this.sea.gain.gain.setTargetAtTime(coast * (0.14 + Math.sin(t * 0.55) * 0.08), t, 0.3);
    this.sea.filter.frequency.setTargetAtTime(450 + Math.sin(t * 0.55) * 200, t, 0.3);
    const purr = paused ? 0 : this.purrTarget;
    this.purrGain.gain.setTargetAtTime(purr * 0.22, t, 0.25);
    this.purrLfo.gain.setTargetAtTime(purr * 0.2, t, 0.25);
    if (paused) return;

    if (night < 0.35 && t > this.nextBird) { this.nextBird = t + rand(1.5, 6); this.chirp(rand(0.4, 1)); }
    if (night > 0.5 && t > this.nextCricket) {
      this.nextCricket = t + rand(0.3, 0.55);
      const f = pick([4100, 4400, 3900]);
      for (let i = 0; i < 3; i++) this.tone({ f0: f, dur: 0.028, vol: 0.016 * night, at: i * 0.045, dest: this.amb });
      if (pond > 0.3 && Math.random() < 0.06) this.croak(pond * 0.7);
    }

    if (!this.musicOn) return;
    if (t > this.nextNote) {
      const scale = night > 0.5 ? NIGHT_SCALE : DAY_SCALE;
      const slow = lerp(1, 1.6, night);
      this.nextNote = t + pick([0.42, 0.42, 0.84, 0.84, 1.26, 1.68]) * slow;
      if (Math.random() < 0.82) {
        this.melody = clamp(this.melody + pick([-2, -1, -1, 1, 1, 2, 0]), 0, scale.length - 1);
        const f = scale[this.melody];
        this.tone({ type: 'triangle', f0: f, dur: 1.5, vol: 0.2, attack: 0.012, dest: this.music });
        this.tone({ type: 'sine', f0: f * 2, dur: 0.6, vol: 0.05, attack: 0.01, dest: this.music });
      }
    }
    if (t > this.nextBass) {
      this.nextBass = t + 3.36 * lerp(1, 1.6, night);
      const root = night > 0.5 ? pick([110, 98, 130.81]) : pick([130.81, 98, 110, 87.31]);
      this.tone({ type: 'sine', f0: root, dur: 3, vol: 0.22, attack: 0.3, dest: this.music });
      this.tone({ type: 'triangle', f0: root * 1.5, dur: 2.4, vol: 0.05, attack: 0.5, dest: this.music });
    }
  }
}
