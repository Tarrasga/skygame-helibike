/**
 * Workout & Interval Training Manager for SkyGame: Helibike
 * Manages HIIT intervals:
 * - Interval 1: 3 min (180s) Warm-up / Normal RPM
 * - Interval 2: 30s Sprint High RPM (Bonus Phase!)
 * - Interval 3: 1 min (60s) Recovery Normal RPM
 * - Interval 4: 30s Sprint High RPM (+Increment RPM)
 * ... repeats with increasing target RPM per level.
 *
 * Difficulties:
 * - Fácil: +10 RPM per sprint level
 * - Normal: +15 RPM per sprint level
 * - Difícil: +20 RPM per sprint level
 */

export class WorkoutManager {
  constructor(difficulty = 'normal') {
    this.difficulty = difficulty; // 'facil', 'normal', 'dificil'
    this.level = 1;
    this.phaseIndex = 0; // 0: warmup (180s), then alternates 30s sprint, 60s recovery
    this.phaseTimer = 0; // seconds elapsed in current phase
    this.phaseDuration = 180; // 3 min initial warmup

    this.isWarmup = true;
    this.isSprint = false;
    this.isRecovery = false;

    this.sprintTargetRpm = 0;
    this.baseNormalRpm = 55;

    this.onPhaseChange = null;
    this.initDifficulty(difficulty);
  }

  setDifficulty(diff) {
    this.difficulty = diff;
    this.initDifficulty(diff);
  }

  initDifficulty(diff) {
    if (diff === 'facil') {
      this.baseNormalRpm = 50;
      this.initialSprintRpm = 65;
      this.rpmIncrement = 10;
    } else if (diff === 'dificil') {
      this.baseNormalRpm = 65;
      this.initialSprintRpm = 85;
      this.rpmIncrement = 20;
    } else {
      // normal
      this.baseNormalRpm = 60;
      this.initialSprintRpm = 75;
      this.rpmIncrement = 15;
    }

    this.reset();
  }

  reset() {
    this.level = 1;
    this.phaseIndex = 0;
    this.phaseTimer = 0;
    this.phaseDuration = 180; // 3 min warmup
    this.isWarmup = true;
    this.isSprint = false;
    this.isRecovery = false;
    this.sprintTargetRpm = this.initialSprintRpm;
  }

  update(delta) {
    this.phaseTimer += delta;

    if (this.phaseTimer >= this.phaseDuration) {
      this.advancePhase();
    }
  }

  advancePhase() {
    this.phaseTimer = 0;
    this.phaseIndex++;

    if (this.phaseIndex === 1) {
      // First Sprint Phase (30s)
      this.isWarmup = false;
      this.isSprint = true;
      this.isRecovery = false;
      this.phaseDuration = 30;
      this.sprintTargetRpm = this.initialSprintRpm;
    } else {
      // Alternating between recovery (60s) and sprint (30s)
      if (this.isSprint) {
        // Switch to Recovery (60s)
        this.isSprint = false;
        this.isRecovery = true;
        this.phaseDuration = 60; // 1 min recovery
      } else {
        // Switch to next Sprint (30s) & advance level!
        this.level++;
        this.isSprint = true;
        this.isRecovery = false;
        this.phaseDuration = 30; // 30s sprint
        this.sprintTargetRpm = this.initialSprintRpm + (this.level - 1) * this.rpmIncrement;
      }
    }

    if (this.onPhaseChange) {
      this.onPhaseChange(this.getStatus());
    }
  }

  getStatus(currentRpm = 0) {
    const remaining = Math.max(0, Math.ceil(this.phaseDuration - this.phaseTimer));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    let phaseName = 'AQUECIMENTO';
    let phaseColor = '#38bdf8';
    let targetRpm = this.baseNormalRpm;

    if (this.isSprint) {
      phaseName = `🔥 SPRINT BÓNUS (NÍVEL ${this.level})`;
      phaseColor = '#f97316';
      targetRpm = this.sprintTargetRpm;
    } else if (this.isRecovery) {
      phaseName = 'RECUPERAÇÃO';
      phaseColor = '#34d399';
      targetRpm = this.baseNormalRpm;
    }

    const isMeetingTarget = currentRpm >= targetRpm;
    const progress = Math.min(1.0, this.phaseTimer / this.phaseDuration);

    return {
      phaseName,
      phaseColor,
      timeFormatted,
      remainingSeconds: remaining,
      progress,
      isSprint: this.isSprint,
      isWarmup: this.isWarmup,
      isRecovery: this.isRecovery,
      level: this.level,
      difficulty: this.difficulty,
      targetRpm,
      currentRpm,
      isMeetingTarget
    };
  }
}
