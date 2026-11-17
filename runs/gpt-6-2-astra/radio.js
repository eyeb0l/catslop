let ctx,
  master,
  noise,
  wash,
  bar = 0,
  next = 0,
  stage = 0,
  muted = false,
  playing = false;
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
function voice(f, t, d, amp, type = 'sine', f2 = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d * 0.84);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(amp, t + Math.min(0.028, d * 0.19));
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + d + 0.03);
}
function hiss(t, d, amp, cutoff) {
  if (!ctx) return;
  let s = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain();
  s.buffer = noise;
  s.loop = true;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff, t);
  f.frequency.exponentialRampToValueAtTime(130, t + d);
  g.gain.setValueAtTime(amp, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + d);
}
export function wake() {
  if (!ctx) {
    let AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.63;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const a = noise.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    let s = ctx.createBufferSource(),
      low = ctx.createBiquadFilter();
    wash = ctx.createGain();
    s.buffer = noise;
    s.loop = true;
    low.type = 'lowpass';
    low.frequency.value = 510;
    wash.gain.value = 0.032;
    s.connect(low).connect(wash).connect(master);
    s.start();
    next = ctx.currentTime + 0.1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}
export function mute(v) {
  muted = v;
  if (ctx) master.gain.setTargetAtTime(v ? 0 : 0.63, ctx.currentTime, 0.045);
}
export function music(s, live) {
  stage = s;
  playing = live;
}
const chords = [
  [50, 57, 62, 66],
  [47, 54, 59, 62],
  [43, 50, 59, 62],
  [45, 52, 61, 64],
  [50, 57, 62, 66],
  [43, 55, 59, 64],
  [45, 52, 61, 67],
  [50, 57, 62, 66],
];
const tune = [74, 0, 73, 71, 0, 66, 67, 71, 74, 73, 0, 69, 66, 69, 74, 76, 0, 71, 73, 69, 67, 66, 0, 0];
export function tick() {
  if (!ctx || ctx.state !== 'running') return;
  let now = ctx.currentTime;
  if (next < now - 0.03) next = now + 0.025;
  while (next < now + 0.28) {
    const b = Math.floor(bar / 3) % 8,
      p = bar % 3,
      c = chords[b],
      d = stage === 2 ? 0.41 : 0.35;
    if (playing) {
      if (!p) {
        voice(hz(c[0]), next, 0.54, 0.104, 'triangle');
        voice(hz(c[0] + 12), next, 0.23, 0.025);
      } else {
        for (let k = 1; k < 4; k++) voice(hz(c[k]), next + k * 0.011, 0.31, 0.026, 'triangle');
      }
      let n = tune[(bar + (stage === 1 ? 6 : 0)) % 24];
      if (n) {
        voice(hz(n), next + 0.028, 0.49, 0.05, 'triangle');
        voice(hz(n) * 2.002, next + 0.052, 0.31, 0.011, 'sine');
      }
      if (stage > 0 && p === 2) voice(hz(c[2] + 12), next + 0.17, 0.2, 0.025);
    }
    if (bar % 31 === 18) {
      voice(1420, next, 0.31, 0.015, 'sine', 960);
      voice(1510, next + 0.39, 0.24, 0.011, 'sine', 1180);
    }
    wash.gain.setTargetAtTime(0.04 + 0.022 * Math.sin(bar * 0.47), next, 0.24);
    bar++;
    next += d;
  }
}
export function fx(kind, n = 0) {
  if (!ctx) return;
  let t = ctx.currentTime;
  if (kind === 'step') {
    hiss(t, 0.045, 0.052, 850);
    voice(135 + n * 11, t, 0.054, 0.04, 'sine', 78);
  }
  if (kind === 'jump') {
    hiss(t, 0.09, 0.075, 1300);
    voice(178, t, 0.12, 0.055, 'triangle', 315);
  }
  if (kind === 'land') {
    hiss(t, 0.08, 0.098, 1050);
    voice(104, t, 0.11, 0.08, 'sine', 58);
  }
  if (kind === 'splash') {
    hiss(t, 0.58, 0.42, 2900);
    voice(273, t, 0.23, 0.13, 'sine', 64);
    voice(428, t + 0.12, 0.17, 0.065, 'sine', 85);
  }
  if (kind === 'meow') {
    const o = ctx.createOscillator(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    o.type = 'sawtooth';
    let base = 385 + n * 13;
    o.frequency.setValueAtTime(base * 0.82, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.42, t + 0.1);
    o.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.34);
    f.type = 'bandpass';
    f.Q.value = 3.8;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(1850, t + 0.11);
    f.frequency.exponentialRampToValueAtTime(620, t + 0.37);
    g.gain.setValueAtTime(0.01, t);
    g.gain.linearRampToValueAtTime(0.145, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.39);
    o.connect(f).connect(g).connect(master);
    o.start();
    o.stop(t + 0.42);
  }
  if (kind === 'stamp' || kind === 'letter' || kind === 'bell') {
    let ns = kind === 'stamp' ? [76, 83] : kind === 'bell' ? [74, 81] : [62, 66, 69, 74, 78];
    ns.forEach((v, i) => {
      voice(hz(v + n), t + i * 0.105, 0.65, 0.105);
      voice(hz(v + n) * 2.01, t + i * 0.105, 0.27, 0.018);
    });
  }
}
