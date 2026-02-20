// ── Web Audio synthesizer for demo SFX ──────────────────────
// All sounds are generated procedurally; no external files needed.

import { IncidentArchetype } from "../shared/types.js";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private ambientActive = false;
  private bgMusic: HTMLAudioElement | null = null;
  private bgMusicStarted = false;
  private ttsEnabled = false;
  private ttsQueue: string[] = [];
  private ttsSpeaking = false;

  /** Lazily initialise AudioContext (must follow a user gesture). */
  private ensure(): { ctx: AudioContext; master: GainNode } {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // overall volume
      this.masterGain.connect(this.ctx.destination);
    }
    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return { ctx: this.ctx, master: this.masterGain! };
  }

  // ── Helper: play a simple tone ──────────────────────────────
  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = "square",
    endFreq?: number,
  ): void {
    const { ctx, master } = this.ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    if (endFreq !== undefined) {
      osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(master);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  // ── Public SFX methods ──────────────────────────────────────

  /** Very short quiet tick for movement (50ms, 200Hz). */
  playMove(): void {
    this.tone(200, 0.05, 0.15, "square");
  }

  /** Satisfying blip for interactions (100ms, 440Hz). */
  playInteract(): void {
    this.tone(440, 0.1, 0.4, "sine");
  }

  /** Sweep sound for scan toggle (150ms, 300->600Hz). */
  playScan(): void {
    this.tone(300, 0.15, 0.35, "sawtooth", 600);
  }

  /** Low buzz for blocked/error actions (80ms, 100Hz). */
  playError(): void {
    this.tone(100, 0.08, 0.3, "sawtooth");
  }

  /** Ascending C-E-G chord played sequentially (150ms each). */
  playVictory(): void {
    const { ctx, master } = this.ensure();
    const notes = [261.63, 329.63, 392.0]; // C4, E4, G4
    const noteDuration = 0.15;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + i * noteDuration;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration * 1.5);

      osc.connect(gain);
      gain.connect(master);
      osc.start(startTime);
      osc.stop(startTime + noteDuration * 1.5);
    });
  }

  /** Descending tone for defeat (400->100Hz over 500ms). */
  playDefeat(): void {
    this.tone(400, 0.5, 0.4, "sawtooth", 100);
  }

  /** Ascending sweep for phase transitions (200->800Hz over 300ms). */
  playPhaseTransition(): void {
    this.tone(200, 0.3, 0.35, "sine", 800);
  }

  /** Two-note notification ping for deduction ready. */
  playDeductionReady(): void {
    this.tone(660, 0.08, 0.3, "sine");
    setTimeout(() => this.tone(880, 0.12, 0.3, "sine"), 100);
  }

  /** Ascending major third for correct deduction (C5-E5). */
  playDeductionCorrect(): void {
    this.tone(523, 0.12, 0.35, "sine");
    setTimeout(() => this.tone(659, 0.2, 0.35, "sine"), 130);
  }

  /** Low descending buzz for wrong deduction. */
  playDeductionWrong(): void {
    this.tone(200, 0.15, 0.3, "sawtooth", 100);
    setTimeout(() => this.tone(150, 0.2, 0.25, "sawtooth", 80), 160);
  }

  /** Brief static burst for PA announcements. */
  playPA(): void {
    const { ctx, master } = this.ensure();
    // White noise burst using buffer source
    const duration = 0.08;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(master);
    source.start(ctx.currentTime);
  }

  /** Sonar ping for choice confirmation. */
  playChoice(): void {
    this.tone(880, 0.1, 0.25, "sine", 440);
  }

  /** Urgent alarm for evacuation phase (three descending tones). */
  playEvacuation(): void {
    this.tone(880, 0.15, 0.4, "square", 660);
    setTimeout(() => this.tone(660, 0.15, 0.35, "square", 440), 200);
    setTimeout(() => this.tone(440, 0.2, 0.3, "square", 330), 450);
  }

  /** Boarding confirmation sound (ascending sweep + click). */
  playCrewBoard(): void {
    this.tone(330, 0.12, 0.3, "sine", 660);
    setTimeout(() => this.tone(880, 0.06, 0.25, "sine"), 150);
  }

  // ── Ambient soundscapes ─────────────────────────────────────

  /** Stop all ambient sound nodes. */
  stopAmbient(): void {
    for (const node of this.ambientNodes) {
      try {
        if (node instanceof OscillatorNode) node.stop();
        else if (node instanceof AudioBufferSourceNode) node.stop();
      } catch { /* already stopped */ }
      node.disconnect();
    }
    this.ambientNodes = [];
    this.ambientActive = false;
  }

  /** Start a looping archetype-specific ambient soundscape. */
  startAmbient(archetype: IncidentArchetype): void {
    if (this.ambientActive) this.stopAmbient();
    const { ctx, master } = this.ensure();
    this.ambientActive = true;

    // Shared ambient gain (very quiet — background texture only)
    const ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.06;
    ambientGain.connect(master);

    switch (archetype) {
      case IncidentArchetype.CoolantCascade:
        this.ambientCoolant(ctx, ambientGain);
        break;
      case IncidentArchetype.HullBreach:
        this.ambientBreach(ctx, ambientGain);
        break;
      case IncidentArchetype.ReactorScram:
        this.ambientReactor(ctx, ambientGain);
        break;
      case IncidentArchetype.Sabotage:
        this.ambientSabotage(ctx, ambientGain);
        break;
      case IncidentArchetype.SignalAnomaly:
        this.ambientSignal(ctx, ambientGain);
        break;
    }
  }

  /** CoolantCascade: Low rumbling drone + metallic shimmer. */
  private ambientCoolant(ctx: AudioContext, dest: AudioNode): void {
    // Deep rumble
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 45;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 80;
    const gain = ctx.createGain();
    gain.gain.value = 0.7;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start();
    this.ambientNodes.push(osc);

    // Slow LFO modulating pitch (thermal pulsing)
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();
    this.ambientNodes.push(lfo);

    // Metallic shimmer (high filtered noise)
    const shimmer = ctx.createOscillator();
    shimmer.type = "triangle";
    shimmer.frequency.value = 2200;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.08;
    const shimmerLfo = ctx.createOscillator();
    shimmerLfo.type = "sine";
    shimmerLfo.frequency.value = 0.3;
    const shimmerLfoGain = ctx.createGain();
    shimmerLfoGain.gain.value = 0.08;
    shimmerLfo.connect(shimmerLfoGain);
    shimmerLfoGain.connect(shimmerGain.gain);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(dest);
    shimmer.start();
    shimmerLfo.start();
    this.ambientNodes.push(shimmer, shimmerLfo);
  }

  /** HullBreach: Deep bass drone + wind-like filtered noise. */
  private ambientBreach(ctx: AudioContext, dest: AudioNode): void {
    // Bass drone
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 35;
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    this.ambientNodes.push(osc);

    // Wind noise (looping buffer)
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 400;
    noiseFilter.Q.value = 0.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.3;
    // Slow sweep on the filter frequency (wind gusts)
    const windLfo = ctx.createOscillator();
    windLfo.type = "sine";
    windLfo.frequency.value = 0.08;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 200;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(noiseFilter.frequency);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start();
    windLfo.start();
    this.ambientNodes.push(noise, windLfo);
  }

  /** ReactorScram: Pulsing electronic hum + digital artifacts. */
  private ambientReactor(ctx: AudioContext, dest: AudioNode): void {
    // 60Hz hum (reactor)
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 60;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 120;
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start();
    this.ambientNodes.push(osc);

    // Pulsing amplitude (breathing pattern)
    const pulseLfo = ctx.createOscillator();
    pulseLfo.type = "sine";
    pulseLfo.frequency.value = 0.25; // ~4s cycle
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.2;
    pulseLfo.connect(pulseGain);
    pulseGain.connect(gain.gain);
    pulseLfo.start();
    this.ambientNodes.push(pulseLfo);

    // Digital artifacts (high pitched beeps)
    const digi = ctx.createOscillator();
    digi.type = "sine";
    digi.frequency.value = 1800;
    const digiGain = ctx.createGain();
    digiGain.gain.value = 0.05;
    const digiLfo = ctx.createOscillator();
    digiLfo.type = "square";
    digiLfo.frequency.value = 0.5; // blips every 2s
    const digiLfoGain = ctx.createGain();
    digiLfoGain.gain.value = 0.05;
    digiLfo.connect(digiLfoGain);
    digiLfoGain.connect(digiGain.gain);
    digi.connect(digiGain);
    digiGain.connect(dest);
    digi.start();
    digiLfo.start();
    this.ambientNodes.push(digi, digiLfo);
  }

  /** Sabotage: Organic low-frequency + irregular scratching texture. */
  private ambientSabotage(ctx: AudioContext, dest: AudioNode): void {
    // Organic drone (slightly detuned sines)
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 56.5; // slight beat frequency
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);
    osc1.start();
    osc2.start();
    this.ambientNodes.push(osc1, osc2);

    // Scratching texture (filtered noise with irregular envelope)
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Irregular bursts
      const t = i / ctx.sampleRate;
      const burst = Math.sin(t * 2.7) > 0.7 ? 1 : 0;
      data[i] = (Math.random() * 2 - 1) * burst;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 2000;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.15;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start();
    this.ambientNodes.push(noise);
  }

  /** SignalAnomaly: Eerie sine harmonics + pulsing alien signal pattern. */
  private ambientSignal(ctx: AudioContext, dest: AudioNode): void {
    // Eerie fifth (A2 + E3, slightly detuned)
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 110;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 164.5; // slightly flat E3
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);
    osc1.start();
    osc2.start();
    this.ambientNodes.push(osc1, osc2);

    // Signal pulse (14.7kHz reference — scaled down to audible)
    const signal = ctx.createOscillator();
    signal.type = "sine";
    signal.frequency.value = 1470; // scaled down from 14.7kHz
    const signalGain = ctx.createGain();
    signalGain.gain.value = 0.0;
    // Pulse envelope: on for 0.1s, off for 3.9s (like the 4s beacon)
    const signalLfo = ctx.createOscillator();
    signalLfo.type = "sine";
    signalLfo.frequency.value = 0.25; // 4s period
    const signalLfoGain = ctx.createGain();
    signalLfoGain.gain.value = 0.06;
    signalLfo.connect(signalLfoGain);
    signalLfoGain.connect(signalGain.gain);
    signal.connect(signalGain);
    signalGain.connect(dest);
    signal.start();
    signalLfo.start();
    this.ambientNodes.push(signal, signalLfo);
  }

  // ── Background music ──────────────────────────────────────

  /** Start looping background music (triggered on first interaction). */
  startBgMusic(): void {
    if (this.bgMusicStarted) return;
    this.bgMusicStarted = true;
    const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || "/";
    const audio = new Audio(`${base}music/8bit_afterglow.mp3`);
    audio.loop = true;
    audio.volume = 0.06; // very quiet background layer
    this.bgMusic = audio;
    audio.play().catch(() => {
      // Autoplay blocked — will retry on next interaction
      this.bgMusicStarted = false;
    });
  }

  /** Stop background music (e.g., on game over). */
  stopBgMusic(): void {
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic.currentTime = 0;
      this.bgMusic = null;
    }
    this.bgMusicStarted = false;
  }

  // ── Text-to-speech ────────────────────────────────────────

  /** Enable or disable TTS for game text. */
  setTTS(enabled: boolean): void {
    this.ttsEnabled = enabled;
    if (!enabled) {
      window.speechSynthesis?.cancel();
      this.ttsQueue = [];
      this.ttsSpeaking = false;
    }
  }

  /** Get current TTS state. */
  isTTSEnabled(): boolean {
    return this.ttsEnabled;
  }

  /** Speak text aloud via browser SpeechSynthesis API. Queues if already speaking. */
  speak(text: string): void {
    if (!this.ttsEnabled || !window.speechSynthesis) return;
    // Strip markup/tags for clean speech
    const clean = text.replace(/<[^>]*>/g, "").replace(/\[.*?\]/g, "").trim();
    if (!clean) return;
    this.ttsQueue.push(clean);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.ttsSpeaking || this.ttsQueue.length === 0) return;
    const text = this.ttsQueue.shift()!;
    this.ttsSpeaking = true;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 0.8; // slightly lower for station computer feel
    utterance.volume = 0.7;
    utterance.onend = () => {
      this.ttsSpeaking = false;
      this.processQueue();
    };
    utterance.onerror = () => {
      this.ttsSpeaking = false;
      this.processQueue();
    };
    window.speechSynthesis.speak(utterance);
  }
}
