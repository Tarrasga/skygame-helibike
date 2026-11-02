import * as THREE from 'three';
import { Helibike } from './helibike.js';
import { World } from './world.js';
import { AudioManager } from './audio.js';
import { BluetoothManager } from './bluetooth.js';
import { WorkoutManager } from './workout.js';
import { RankingManager } from './ranking.js';

export class Game {
  constructor(container) {
    this.container = container;

    // Core Managers
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.helibike = null;
    this.world = null;
    this.audio = new AudioManager();
    this.bluetooth = new BluetoothManager();
    this.workout = new WorkoutManager('normal');
    this.ranking = new RankingManager();

    // Flight Physics (X locked to 0 - No lateral movement!)
    this.position = new THREE.Vector3(0, 32, 0);
    this.velocity = new THREE.Vector3(0, 0, 18);

    // Bike Data State
    this.currentCadence = 0;
    this.targetCadence = 0;
    this.currentSpeedKmh = 0;
    this.currentPowerWatts = 0;
    this.currentHeartRate = null;
    this.maxRpmRecorded = 0;

    // Simulation / Demo Mode
    this.isSimulated = false;
    this.simRpm = 60;

    // Game Progression & Stats
    this.score = 0;
    this.combo = 1;
    this.distanceMeters = 0;
    this.calories = 0;
    this.totalSeconds = 0;

    // Keyboard keys for RPM simulation (W/S or Up/Down)
    this.keys = {};

    this.onHUDUpdate = null;

    this.initThree();
    this.initControls();
    this.initBluetoothCallbacks();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x38bdf8);

    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.container.appendChild(this.renderer.domElement);

    this.helibike = new Helibike();
    this.scene.add(this.helibike.mesh);

    this.world = new World(this.scene);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initControls() {
    // Only W/S or Arrow Up/Down for RPM simulation
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      this.audio.resume();

      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        this.simRpm = Math.min(140, this.simRpm + 5);
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        this.simRpm = Math.max(0, this.simRpm - 5);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  initBluetoothCallbacks() {
    this.bluetooth.onBikeData = (data) => {
      this.targetCadence = data.cadence;
      this.currentSpeedKmh = data.speed;
      this.currentPowerWatts = data.power;
    };

    this.bluetooth.onHeartRateData = (data) => {
      this.currentHeartRate = data;
    };
  }

  setDifficulty(diff) {
    this.workout.setDifficulty(diff);
  }

  start() {
    this.clock = new THREE.Clock();
    this.audio.init();
    this.animate();
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.update(delta);
    this.renderer.render(this.scene, this.camera);
  }

  update(delta) {
    this.totalSeconds += delta;

    // 1. Cadence determination
    if (this.isSimulated || (!this.bluetooth.bikeDevice && this.targetCadence === 0)) {
      this.targetCadence = this.simRpm;
      this.currentSpeedKmh = (this.targetCadence / 80) * 32;
    }

    this.currentCadence = THREE.MathUtils.lerp(this.currentCadence, this.targetCadence, delta * 3.5);

    if (this.currentCadence > this.maxRpmRecorded) {
      this.maxRpmRecorded = Math.round(this.currentCadence);
    }

    // 2. Update Workout Intervals (Warmup -> Sprint -> Recovery -> Sprint...)
    this.workout.update(delta);
    const workoutStatus = this.workout.getStatus(Math.round(this.currentCadence));

    // 3. Flight Dynamics & Altitude Physics (Purely Cadence Driven!)
    // Cruise altitude balance is ~55 RPM
    // Sprints (>75-100+ RPM) generate rapid ascent to reach high golden rings!
    const baseRpm = 55.0;
    const rpmDifference = this.currentCadence - baseRpm;

    let verticalThrust = 0;
    if (rpmDifference > 0) {
      // Climbing
      verticalThrust = (rpmDifference / 40.0) * 18.0;
    } else {
      // Gliding down gently
      verticalThrust = (rpmDifference / 40.0) * 10.0;
    }

    // Forward Speed scales with Cadence
    const forwardSpeed = 14.0 + (this.currentCadence / 100.0) * 16.0;
    this.velocity.z = forwardSpeed;

    // Lateral position is LOCKED to 0 (No left/right steering!)
    this.position.x = 0;

    // Altitude clamped between 10m and 130m
    this.position.y += verticalThrust * delta;
    this.position.y = THREE.MathUtils.clamp(this.position.y, 10, 130);

    this.position.z += this.velocity.z * delta;
    this.distanceMeters = this.position.z;

    this.helibike.mesh.position.copy(this.position);

    const isSprint = workoutStatus.isSprint && workoutStatus.isMeetingTarget;
    this.helibike.update(delta, this.currentCadence, forwardSpeed, isSprint);

    // 4. Audio
    this.audio.updatePropeller(this.currentCadence);

    // 5. Update 3D World (Rings & Gems centered on X = 0)
    this.world.update(
      delta,
      this.position,
      workoutStatus.isSprint,
      (ring) => this.handleRingCollected(ring, workoutStatus),
      (gem) => this.handleGemCollected(gem, workoutStatus)
    );

    // 6. Camera - Centered behind Helibike with dramatic climb/dive tracking
    const cameraTargetPos = new THREE.Vector3(
      0,
      this.position.y + 2.6,
      this.position.z - 7.5
    );
    this.camera.position.lerp(cameraTargetPos, delta * 7.0);

    const lookAtTarget = new THREE.Vector3(
      0,
      this.position.y + 1.2,
      this.position.z + 18
    );
    this.camera.lookAt(lookAtTarget);

    // 7. Calories calculation
    const calPerSecond = (0.12 + (this.currentCadence / 100) * 0.2);
    this.calories += calPerSecond * delta;

    // 8. HUD Update
    if (this.onHUDUpdate) {
      this.onHUDUpdate({
        cadence: Math.round(this.currentCadence),
        speed: Math.round(this.currentSpeedKmh || forwardSpeed * 2.2),
        altitude: Math.round(this.position.y),
        score: this.score,
        combo: this.combo,
        distanceKm: (this.distanceMeters / 1000).toFixed(2),
        calories: Math.round(this.calories),
        heartRate: this.currentHeartRate,
        workout: workoutStatus,
        maxRpm: this.maxRpmRecorded
      });
    }
  }

  handleRingCollected(ring, workoutStatus) {
    // SPRINT BONUS MULTIPLIER:
    // If in sprint phase and meeting or exceeding target RPM -> HUGE 3X MULTIPLIER!
    let phaseMultiplier = 1.0;
    if (workoutStatus.isSprint) {
      phaseMultiplier = workoutStatus.isMeetingTarget ? 3.0 : 1.5;
    }

    // Smartwatch Cardio bonus
    let hrMultiplier = 1.0;
    if (this.currentHeartRate && this.currentHeartRate.zone.level >= 3) {
      hrMultiplier = 1.4;
    }

    const earned = Math.round(ring.points * this.combo * phaseMultiplier * hrMultiplier);
    this.score += earned;
    this.combo = Math.min(15, this.combo + 1);

    this.audio.playRingChime(ring.type);
  }

  handleGemCollected(gem, workoutStatus) {
    const multiplier = workoutStatus.isSprint && workoutStatus.isMeetingTarget ? 2.5 : 1.0;
    this.score += Math.round(gem.points * multiplier);
    this.audio.playGemChime();
  }
}
