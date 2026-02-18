// ── Web Audio synthesizer for demo SFX ──────────────────────
// All sounds are generated procedurally; no external files needed.

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

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
}
