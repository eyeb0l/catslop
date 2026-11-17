// The score and effects are synthesised locally. Nothing is streamed or sampled.
const frequency = note => 440 * 2 ** ((note - 69) / 12);
const harmony = [
  [48, 55, 59, 62, 64], [45, 55, 59, 60, 64],
  [41, 53, 57, 60, 64], [43, 53, 57, 59, 62],
  [40, 52, 55, 59, 62], [45, 55, 60, 64, 67],
  [41, 53, 57, 60, 62], [43, 53, 55, 59, 62],
];
const topline = [
  [76, 74, 71], [72, 76, 79], [76, 72, 69], [71, 67, null],
  [74, 71, 67], [72, 76, 81], [79, 76, 74], [71, 74, null],
];

export class LaundretteAudio {
  constructor(muted) {
    this.muted = muted;
    this.running = false;
    this.step = 0;
  }

  open() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return;
    }
    if (!window.AudioContext) return;
    const c = this.context = new AudioContext();
    const out = this.master = c.createGain();
    out.gain.value = this.muted ? 0 : .80;
    const safe = c.createDynamicsCompressor();
    safe.threshold.value = -16;
    safe.ratio.value = 2.5;
    out.connect(safe).connect(c.destination);
    const rest = this.music = c.createGain();
    rest.gain.value = .62;
    rest.connect(out);
    const room = this.room = c.createDelay();
    room.delayTime.value = .221;
    const feedback = c.createGain();
    feedback.gain.value = .22;
    const low = c.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 1700;
    room.connect(low).connect(feedback);
    feedback.connect(room);
    feedback.connect(rest);
    const noise = this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const samples = noise.getChannelData(0);
    let smooth = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      smooth = smooth * .82 + white * .18;
      samples[i] = white * .55 + smooth * .45;
    }
    const rain = c.createBufferSource();
    rain.buffer = noise;
    rain.loop = true;
    const rainy = c.createBiquadFilter();
    rainy.type = 'bandpass';
    rainy.frequency.value = 1120;
    rainy.Q.value = .51;
    this.rain = c.createGain();
    this.rain.gain.value = .072;
    rain.connect(rainy).connect(this.rain).connect(out);
    rain.start();
    this.hum = c.createOscillator();
    this.hum.type = 'triangle';
    this.hum.frequency.value = 63;
    this.humGain = c.createGain();
    this.humGain.gain.value = 0;
    this.hum.connect(this.humGain).connect(out);
    this.hum.start();
    const purr = c.createOscillator();
    purr.type = 'triangle';
    purr.frequency.value = 52;
    const pulse = c.createOscillator();
    pulse.frequency.value = 24;
    const depth = c.createGain();
    depth.gain.value = .40;
    const flutter = c.createGain();
    flutter.gain.value = .52;
    this.purrGain = c.createGain();
    this.purrGain.gain.value = 0;
    pulse.connect(depth).connect(flutter.gain);
    purr.connect(flutter).connect(this.purrGain).connect(out);
    purr.start();
    pulse.start();
    this.next = c.currentTime + .12;
    c.resume().catch(() => {});
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.context) this.master.gain.setTargetAtTime(muted ? 0 : .8, this.context.currentTime, .055);
  }

  tick(running, intensity, motor, resting, purr = 0) {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    const now = c.currentTime;
    if (this.running !== running) {
      this.running = running;
      this.music.gain.setTargetAtTime(running ? .67 : .12, now, .16);
      this.rain.gain.setTargetAtTime(running ? .073 : .041, now, .23);
    }
    this.humGain.gain.setTargetAtTime(running ? motor * (.028 + intensity * .04) : 0, now, .1);
    this.hum.frequency.setTargetAtTime(58 + intensity * 49, now, .12);
    this.purrGain.gain.setTargetAtTime(purr * .078, now, .45);
    if (!running) return;
    if (this.next < now) this.next = now + .03;
    while (this.next < now + .31) {
      const beat = this.step % 8;
      const bar = Math.floor(this.step / 8) % harmony.length;
      const chord = harmony[bar];
      const when = this.next;
      if (beat === 0 || beat === 4) {
        this.key(chord[0] + (beat === 4 ? 12 : 0), when, .64, .15, true);
        for (let i = 1; i < chord.length; i++) {
          this.key(chord[i], when + i * .023, beat === 0 ? 1.6 : .53, beat === 0 ? .062 : .038);
        }
      }
      const lead = [1, 3, 6].indexOf(beat);
      const note = lead < 0 ? null : topline[bar][lead];
      if (note) this.key(note, when, lead === 2 ? .98 : .56, resting ? .062 : .08);
      if (beat === 2 || beat === 6) this.brush(when, .13, 1180, resting ? .021 : .036);
      if (beat === 0 && intensity > .1) this.key(chord[0] - 12, when, .23, .09 * intensity, true);
      this.next += .32 + (beat % 2 ? -.029 : .029);
      this.step++;
    }
  }

  key(note, when, length, strength, bass = false, effects = false) {
    const c = this.context;
    if (!c) return;
    const tone = c.createOscillator();
    const overtone = c.createOscillator();
    const over = c.createGain();
    const env = c.createGain();
    const hz = frequency(note);
    tone.type = bass ? 'triangle' : 'sine';
    tone.frequency.value = hz;
    overtone.frequency.value = hz * (bass ? 2.04 : 3.001);
    over.gain.setValueAtTime(bass ? .08 : .24, when);
    over.gain.exponentialRampToValueAtTime(.001, when + length * .52);
    env.gain.setValueAtTime(.0001, when);
    env.gain.exponentialRampToValueAtTime(Math.max(.001, strength), when + .012);
    env.gain.exponentialRampToValueAtTime(.0001, when + length);
    overtone.connect(over).connect(env);
    tone.connect(env);
    env.connect(effects ? this.master : this.music);
    if (!bass) env.connect(this.room);
    tone.start(when);
    overtone.start(when);
    tone.stop(when + length + .03);
    overtone.stop(when + length + .03);
  }

  brush(when, length, cutoff, gain, type = 'bandpass') {
    const c = this.context;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const noiseFilter = c.createBiquadFilter();
    noiseFilter.type = type;
    noiseFilter.frequency.setValueAtTime(cutoff, when);
    noiseFilter.frequency.exponentialRampToValueAtTime(cutoff * .57, when + length);
    noiseFilter.Q.value = .71;
    const env = c.createGain();
    env.gain.setValueAtTime(.001, when);
    env.gain.linearRampToValueAtTime(gain, when + .013);
    env.gain.exponentialRampToValueAtTime(.001, when + length);
    s.connect(noiseFilter).connect(env).connect(this.master);
    s.start(when, Math.random() * .7);
    s.stop(when + length + .035);
  }

  meow(kitten = -1) {
    const c = this.context;
    if (!c) return;
    const time = c.currentTime + .012;
    const k = kitten < 0 ? 1 : 1.39 + kitten * .10;
    const s = c.createOscillator();
    s.type = 'sawtooth';
    s.frequency.setValueAtTime(295 * k, time);
    s.frequency.exponentialRampToValueAtTime(489 * k, time + .085);
    s.frequency.exponentialRampToValueAtTime(405 * k, time + .21);
    s.frequency.exponentialRampToValueAtTime(225 * k, time + .38);
    const vibrato = c.createOscillator();
    const vibratoAmount = c.createGain();
    vibrato.frequency.value = 23;
    vibratoAmount.gain.value = 8 * k;
    vibrato.connect(vibratoAmount).connect(s.frequency);
    const env = c.createGain();
    env.gain.setValueAtTime(.0001, time);
    env.gain.linearRampToValueAtTime(kitten < 0 ? .166 : .107, time + .055);
    env.gain.exponentialRampToValueAtTime(.088, time + .21);
    env.gain.exponentialRampToValueAtTime(.0001, time + .425);
    for (const [start, end, q] of [[1000, 562, 2.6], [1740, 1320, 3.8]]) {
      const formant = c.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(start * k, time);
      formant.frequency.exponentialRampToValueAtTime(end * k, time + .35);
      formant.Q.value = q;
      s.connect(formant).connect(env);
    }
    env.connect(this.master);
    env.connect(this.room);
    s.start(time);
    vibrato.start(time);
    s.stop(time + .46);
    vibrato.stop(time + .46);
  }

  cue(name) {
    if (!this.context) return;
    const t = this.context.currentTime + .007;
    if (name === 'paw') this.brush(t, .095, 400, .075);
    if (name === 'jump') this.brush(t, .15, 466, .12);
    if (name === 'land') this.brush(t, .16, 275, .25, 'lowpass');
    if (name === 'bump') {
      this.brush(t, .24, 440, .23);
      this.key(43, t, .29, .12, true, true);
    }
    const motifs = {
      start: [55, 60, 64],
      sock: [79, 84],
      follow: [69, 72, 76],
      home: [60, 67, 72, 76],
      reward: [67, 72, 76, 81, 84],
      end: [60, 64, 67, 71, 76, 79, 84],
    };
    motifs[name]?.forEach((note, i) => this.key(note, t + i * (name === 'sock' ? .061 : .088), .75 + i * .1, .122, false, true));
  }
}
