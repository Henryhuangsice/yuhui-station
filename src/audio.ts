type Sfx =
  | 'click' | 'hover' | 'open' | 'close' | 'blip' | 'step' | 'splash' | 'jump' | 'land' | 'emoji' | 'coin' | 'rattle' | 'reveal' | 'rare' | 'bell' | 'quest'
  | 'knock' | 'bigbell' | 'qing' | 'match' | 'chime' | 'whoosh' | 'pop' | 'levelup' | 'boom' | 'stick';

export type Scene = 'town' | 'temple' | 'church' | 'dao';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const TOWN_CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const TOWN_SCALE = [72, 74, 76, 79, 81, 84, 86];

const HYMN = [
  [48, 55, 64, 67],
  [47, 55, 62, 67],
  [45, 57, 64, 69],
  [43, 55, 62, 71],
  [41, 57, 65, 69],
  [40, 55, 64, 67],
  [38, 57, 65, 69],
  [43, 55, 62, 71],
];
const HYMN_TUNE = [76, 74, 72, 74, 76, 76, 76, 74, 74, 76, 79, 79, 76, 74, 72, 74];
const DAO_SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81];

const SPB: Record<Scene, number> = { town: 60 / 70 / 2, temple: 60 / 92, church: 60 / 58, dao: 60 / 66 };

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfxBus!: GainNode;
  private delay!: DelayNode;
  private verb!: ConvolverNode;
  private noise!: AudioBuffer;
  private buses = {} as Record<Scene, GainNode>;
  private sends = {} as Record<Scene, GainNode>;
  private next = 0;
  private beat = 0;
  private timer: number | null = null;
  private windGain: GainNode | null = null;
  scene: Scene = 'town';
  musicOn = true;
  sfxOn = true;

  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicOn ? 0.55 : 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    this.music.connect(lp).connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.8 : 0;
    this.sfxBus.connect(this.master);

    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(3.2, 2.4);
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.9;
    this.verb.connect(verbOut).connect(this.music);

    const sendAmt: Record<Scene, number> = { town: 0.12, temple: 0.55, church: 1.0, dao: 0.5 };
    for (const s of ['town', 'temple', 'church', 'dao'] as Scene[]) {
      const g = ctx.createGain();
      g.gain.value = s === this.scene ? 1 : 0;
      g.connect(this.music);
      const send = ctx.createGain();
      send.gain.value = sendAmt[s];
      g.connect(send).connect(this.verb);
      this.buses[s] = g;
      this.sends[s] = send;
    }

    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(this.buses.town);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.crackle();
    this.wind();
    this.next = ctx.currentTime + 0.2;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  setScene(s: Scene) {
    if (s === this.scene) return;
    this.scene = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const k of Object.keys(this.buses) as Scene[]) this.buses[k].gain.setTargetAtTime(k === s ? 1 : 0, t, 0.9);
    this.windGain?.gain.setTargetAtTime(s === 'dao' ? 0.05 : 0.0, t, 1.2);
    this.beat = 0;
    this.next = Math.max(this.next, t + 0.4);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx) this.music.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.3);
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  private crackle() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    src.connect(bp).connect(g).connect(this.buses.town);
    src.start();
  }

  private wind() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    src.connect(lp).connect(this.windGain).connect(this.music);
    src.start();
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.next < ctx.currentTime + 0.3) {
      const t = this.next;
      const s = this.scene;
      const spb = SPB[s];
      let dur = spb;
      if (s === 'town') dur = this.townBeat(t, spb);
      else if (s === 'temple') this.templeBeat(t, spb);
      else if (s === 'church') this.churchBeat(t, spb);
      else this.daoBeat(t, spb);
      this.next += dur;
      this.beat++;
    }
  }

  private townBeat(t: number, spb: number) {
    const step = this.beat % 32;
    const chord = TOWN_CHORDS[Math.floor(this.beat / 16) % TOWN_CHORDS.length];
    const bus = this.buses.town;
    if (this.beat % 16 === 0) chord.forEach((n) => this.pad(midi(n), t, spb * 16, bus));
    if (step % 8 === 0) this.kick(t, bus);
    if (step % 8 === 4) this.noiseHit(t, 'bandpass', 1800, 0.05, 0.18, bus);
    if (step % 2 === 1) this.noiseHit(t, 'highpass', 7000, 0.018, 0.05, bus);
    if (step % 4 === 0) this.sine(midi(chord[0] - 12), t, spb * 3, 0.09, bus);
    if (Math.random() < 0.3 && step % 2 === 0) this.pluck(midi(TOWN_SCALE[Math.floor(Math.random() * TOWN_SCALE.length)]), t, bus, true);
    return spb * (step % 2 === 0 ? 1.12 : 0.88);
  }

  private templeBeat(t: number, spb: number) {
    const bus = this.buses.temple;
    const b = this.beat % 32;
    if (this.beat % 32 === 0) {
      this.sine(midi(45), t, spb * 32, 0.05, bus, 4);
      this.sine(midi(52), t, spb * 32, 0.025, bus, 4);
    }
    this.woodfish(t, bus, 0.09);
    const syll = b % 8;
    if (syll < 6 && b < 24) this.chant(midi(syll === 5 ? 43 : 45), t, spb * (syll === 5 ? 1.8 : 0.9), syll % 2 ? 'o' : 'a', bus);
    if (b === 0 || b === 16) this.bowl(t + 0.05, bus, 0.07);
  }

  private churchBeat(t: number, spb: number) {
    const bus = this.buses.church;
    const bar = Math.floor(this.beat / 4);
    const chord = HYMN[bar % HYMN.length];
    if (this.beat % 4 === 0) {
      chord.forEach((n, i) => this.organ(midi(n), t, spb * 4.1, i === 0 ? 0.05 : 0.03, bus));
      chord.slice(1).forEach((n) => this.choir(midi(n + 12), t, spb * 4.1, bus));
    }
    if (this.beat % 2 === 0) this.organ(midi(HYMN_TUNE[(this.beat / 2) % HYMN_TUNE.length]), t, spb * 2, 0.035, bus, true);
  }

  private daoBeat(t: number, spb: number) {
    const bus = this.buses.dao;
    if (this.beat % 32 === 0) this.sine(midi(38), t, spb * 32, 0.04, bus, 5);
    if (Math.random() < 0.42) this.qin(midi(DAO_SCALE[Math.floor(Math.random() * DAO_SCALE.length)]), t + Math.random() * 0.08, bus);
    if (this.beat % 16 === 8 && Math.random() < 0.6) this.flute(midi(DAO_SCALE[3 + Math.floor(Math.random() * 5)] + 12), t, spb * 3.5, bus);
    if (this.beat % 24 === 0) this.bowl(t, bus, 0.04);
  }

  private env(g: GainNode, t: number, a: number, peak: number, dur: number, rel: number) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
    g.gain.linearRampToValueAtTime(0, t + dur);
  }

  private osc(type: OscillatorType, f: number, t: number, dur: number, dest: AudioNode, detune = 0) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.1);
    return o;
  }

  private pad(f: number, t: number, dur: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    this.env(g, t, 1.2, 0.035, dur, 1.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    g.connect(lp).connect(bus);
    for (const det of [-7, 7]) this.osc('triangle', f, t, dur, g, det);
  }

  private sine(f: number, t: number, dur: number, gain: number, bus: AudioNode, attack = 0.02) {
    const g = this.ctx!.createGain();
    this.env(g, t, attack, gain, dur, Math.min(dur * 0.5, 2));
    g.connect(bus);
    this.osc('sine', f, t, dur, g);
  }

  private pluck(f: number, t: number, bus: AudioNode, echo = false) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 1.1);
    g.connect(bus);
    if (echo) g.connect(this.delay);
    this.osc('sine', f, t, 1.2, g);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    g2.connect(g);
    this.osc('sine', f * 2.01, t, 1.2, g2);
  }

  private kick(t: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.32);
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, gain: number, dur: number, bus: AudioNode, q = 1) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  private woodfish(t: number, bus: AudioNode, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(820, t);
    o.frequency.exponentialRampToValueAtTime(560, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.2);
    this.noiseHit(t, 'bandpass', 2400, gain * 0.5, 0.03, bus, 4);
  }

  private bowl(t: number, bus: AudioNode, gain: number) {
    for (const [ratio, g] of [[1, 1], [2.71, 0.5], [5.2, 0.25]] as const) {
      const gn = this.ctx!.createGain();
      gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(gain * g, t + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0004, t + 5);
      gn.connect(bus);
      this.osc('sine', 520 * ratio, t, 5, gn, Math.random() * 6);
    }
  }

  private chant(f: number, t: number, dur: number, vowel: 'a' | 'o', bus: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    this.env(g, t, 0.08, 0.06, dur, 0.25);
    const formants = vowel === 'a' ? [700, 1150, 2600] : [450, 800, 2830];
    const gains = [1, 0.5, 0.15];
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(f, t);
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.5;
    const vibG = ctx.createGain();
    vibG.gain.value = 1.2;
    vib.connect(vibG).connect(src.frequency);
    formants.forEach((fq, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fq;
      bp.Q.value = 9;
      const gg = ctx.createGain();
      gg.gain.value = gains[i] * 2.4;
      src.connect(bp).connect(gg).connect(g);
    });
    g.connect(bus);
    src.start(t);
    vib.start(t);
    src.stop(t + dur + 0.1);
    vib.stop(t + dur + 0.1);
  }

  private organ(f: number, t: number, dur: number, gain: number, bus: AudioNode, flute = false) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    this.env(g, t, flute ? 0.06 : 0.25, gain, dur, flute ? 0.2 : 0.6);
    g.connect(bus);
    const harmonics = flute ? [[1, 1], [2, 0.3]] : [[1, 1], [2, 0.5], [3, 0.25], [4, 0.12], [0.5, 0.4]];
    for (const [h, a] of harmonics) {
      const gg = ctx.createGain();
      gg.gain.value = a;
      gg.connect(g);
      this.osc('sine', f * h, t, dur, gg, (Math.random() - 0.5) * 4);
    }
  }

  private choir(f: number, t: number, dur: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    this.env(g, t, 1.1, 0.022, dur, 1.0);
    g.connect(bus);
    for (const det of [-9, 0, 9]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      for (const [fq, a] of [[800, 1], [1150, 0.6], [2900, 0.25]] as const) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fq;
        bp.Q.value = 7;
        const gg = ctx.createGain();
        gg.gain.value = a;
        o.connect(bp).connect(gg).connect(g);
      }
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  private qin(f: number, t: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.06, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 2.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(600, t + 1.5);
    o.connect(lp).connect(g).connect(bus);
    o.start(t);
    o.stop(t + 2.7);
  }

  private flute(f: number, t: number, dur: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    this.env(g, t, 0.35, 0.035, dur, 0.8);
    g.connect(bus);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.3);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = ctx.createGain();
    vg.gain.value = f * 0.012;
    vib.connect(vg).connect(o.frequency);
    o.connect(g);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.1);
    vib.stop(t + dur + 0.1);
    this.noiseHit(t, 'bandpass', f * 2, 0.012, dur, bus, 2);
  }

  private tone(f: number, t: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  play(name: Sfx) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime;
    const bus = this.sfxBus;
    switch (name) {
      case 'click':
        this.tone(880, t, 0.07, 0.12, 'triangle', 660);
        break;
      case 'hover':
        this.tone(1320, t, 0.04, 0.04, 'sine');
        break;
      case 'open':
        this.tone(520, t, 0.12, 0.1, 'triangle', 900);
        this.noiseHit(t, 'bandpass', 2400, 0.04, 0.1, bus);
        break;
      case 'close':
        this.tone(760, t, 0.1, 0.08, 'triangle', 420);
        break;
      case 'blip':
        this.tone(380 + Math.random() * 160, t, 0.05, 0.05, 'square');
        break;
      case 'step':
        this.noiseHit(t, 'bandpass', 700 + Math.random() * 300, 0.07, 0.07, bus);
        break;
      case 'splash':
        this.noiseHit(t, 'bandpass', 1500 + Math.random() * 600, 0.08, 0.16, bus);
        break;
      case 'jump':
        this.tone(300, t, 0.14, 0.07, 'sine', 620);
        break;
      case 'land':
        this.noiseHit(t, 'lowpass', 500, 0.14, 0.12, bus);
        break;
      case 'emoji':
        this.tone(660, t, 0.1, 0.09, 'sine', 990);
        this.tone(990, t + 0.07, 0.12, 0.07, 'sine');
        break;
      case 'coin':
        this.tone(1175, t, 0.09, 0.1, 'square');
        this.tone(1568, t + 0.08, 0.22, 0.09, 'square');
        break;
      case 'rattle':
        for (let i = 0; i < 8; i++) this.noiseHit(t + i * 0.07, 'bandpass', 2600 + Math.random() * 1200, 0.07, 0.05, bus);
        break;
      case 'reveal':
        [72, 76, 79, 84].forEach((n, i) => this.tone(midi(n), t + i * 0.08, 0.5, 0.08, 'triangle'));
        break;
      case 'rare':
        [72, 76, 79, 84, 88, 91].forEach((n, i) => this.tone(midi(n), t + i * 0.07, 0.8, 0.08, 'triangle'));
        break;
      case 'bell':
        this.tone(midi(84), t, 1.2, 0.08, 'sine');
        this.tone(midi(79), t + 0.35, 1.4, 0.08, 'sine');
        break;
      case 'quest':
        [67, 72, 76].forEach((n, i) => this.tone(midi(n), t + i * 0.1, 0.4, 0.09, 'triangle'));
        break;
      case 'knock':
        this.woodfish(t, bus, 0.3);
        break;
      case 'bigbell':
        for (const [ratio, g, d] of [[1, 0.16, 7], [2.0, 0.08, 5], [2.76, 0.07, 4], [5.4, 0.03, 2.5], [0.5, 0.1, 8]] as const) {
          const gn = ctx.createGain();
          gn.gain.setValueAtTime(0, t);
          gn.gain.linearRampToValueAtTime(g, t + 0.01);
          gn.gain.exponentialRampToValueAtTime(0.0004, t + d);
          gn.connect(bus);
          gn.connect(this.verb);
          this.osc('sine', 98 * ratio, t, d, gn, Math.random() * 4);
        }
        this.noiseHit(t, 'lowpass', 300, 0.2, 0.2, bus);
        break;
      case 'qing':
        this.bowl(t, bus, 0.12);
        break;
      case 'match':
        this.noiseHit(t, 'highpass', 3000, 0.12, 0.08, bus);
        this.noiseHit(t + 0.05, 'bandpass', 900, 0.05, 0.5, bus);
        break;
      case 'chime':
        [88, 93, 96].forEach((n, i) => this.tone(midi(n), t + i * 0.12, 1.6, 0.05, 'sine'));
        break;
      case 'whoosh': {
        const s = ctx.createBufferSource();
        s.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(200, t);
        f.frequency.linearRampToValueAtTime(900, t + 1.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.6);
        g.gain.linearRampToValueAtTime(0, t + 1.6);
        s.connect(f).connect(g).connect(bus);
        s.start(t);
        s.stop(t + 1.7);
        break;
      }
      case 'pop':
        this.tone(420, t, 0.18, 0.12, 'sine', 1300);
        [84, 88, 91].forEach((n, i) => this.tone(midi(n), t + 0.12 + i * 0.06, 0.5, 0.05, 'triangle'));
        break;
      case 'levelup':
        [62, 66, 69, 74, 78, 81, 86].forEach((n, i) => this.tone(midi(n), t + i * 0.09, 0.9, 0.07, 'triangle'));
        this.bowl(t + 0.6, bus, 0.08);
        break;
      case 'boom':
        this.noiseHit(t, 'lowpass', 400, 0.5, 0.9, bus);
        this.tone(90, t, 0.6, 0.25, 'sine', 40);
        break;
      case 'stick':
        this.woodfish(t, bus, 0.12);
        this.noiseHit(t + 0.08, 'bandpass', 3000, 0.05, 0.05, bus, 3);
        break;
    }
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
  }
}
