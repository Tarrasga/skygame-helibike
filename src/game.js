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

    // Game States: 'menu' | 'playing' | 'paused'
    this.state = 'menu';

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

    // Flight Physics
    this.position = new THREE.Vector3(0, 36, 0);
    this.velocity = new THREE.Vector3(0, 0, 18);

    // Bike Data State
    this.currentCadence = 55;
    this.targetCadence = 55;
    this.currentSpeedKmh = 22;
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

    this.keys = {};
    this.onHUDUpdate = null;
    this.onStateChange = null;

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

  startFlight() {
    this.state = 'playing';
    this.workout.reset();
    this.score = 0;
    this.combo = 1;
    this.distanceMeters = 0;
    this.calories = 0;
    this.maxRpmRecorded = 0;
    this.position.set(0, 36, 0);
    this.audio.resume();

    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  pauseFlight() {
    this.state = 'paused';
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  resumeFlight() {
    this.state = 'playing';
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  returnToMenu() {
    this.state = 'menu';
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
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
    // 1. MENU STATE: Cinematic Showcase Hover
    if (this.state === 'menu') {
      const time = performance.now() * 0.001;
      this.helibike.mesh.position.set(0, 36 + Math.sin(time * 1.5) * 0.5, 0);
      this.helibike.mesh.rotation.y = Math.sin(time * 0.6) * 0.35;
      this.helibike.mesh.rotation.z = Math.sin(time * 1.2) * 0.06;

      // Gentle rotor idle spin
      this.helibike.update(delta, 45, 0, false);

      // Camera views the Helibike slightly from the front/side
      const camX = Math.sin(time * 0.3) * 6;
      const camZ = -9 + Math.cos(time * 0.3) * 3;
      this.camera.position.lerp(new THREE.Vector3(camX, 38, camZ), delta * 4);
      this.camera.lookAt(new THREE.Vector3(0, 36.5, 0));
      return;
    }

    // 2. PAUSED STATE
    if (this.state === 'paused') {
      return;
    }

    // 3. PLAYING STATE: Full Flight Simulation
    this.totalSeconds += delta;

    // Cadence determination
    if (this.isSimulated || (!this.bluetooth.bikeDeviceId && this.targetCadence === 0)) {
      this.targetCadence = this.simRpm;
      this.currentSpeedKmh = (this.targetCadence / 80) * 32;
    }

    this.currentCadence = THREE.MathUtils.lerp(this.currentCadence, this.targetCadence, delta * 3.0);

    if (this.currentCadence > this.maxRpmRecorded) {
      this.maxRpmRecorded = Math.round(this.currentCadence);
    }

    // Workout Intervals advancement
    this.workout.update(delta);
    const workoutStatus = this.workout.getStatus(Math.round(this.currentCadence));

    // Target flight altitude based on Cadence RPM (Aerodynamic equilibrium)
    let targetAltitude = 18;
    if (this.currentCadence > 30) {
      const norm = Math.min(1.0, (this.currentCadence - 30) / 90.0);
      targetAltitude = 18 + Math.pow(norm, 1.15) * 102;
    }

    this.position.y = THREE.MathUtils.lerp(this.position.y, targetAltitude, delta * 2.8);
    this.position.x = 0;

    // Forward Speed
    const forwardSpeed = 14.0 + (this.currentCadence / 100.0) * 16.0;
    this.velocity.z = forwardSpeed;
    this.position.z += this.velocity.z * delta;
    this.distanceMeters = this.position.z;

    this.helibike.mesh.position.copy(this.position);

    const isSprint = workoutStatus.isSprint && workoutStatus.isMeetingTarget;
    this.helibike.update(delta, this.currentCadence, forwardSpeed, isSprint);

    // Audio
    this.audio.updatePropeller(this.currentCadence);

    // World Update (Rings & Gems)
    this.world.update(
      delta,
      this.position,
      workoutStatus.isSprint,
      workoutStatus.targetRpm,
      (ring) => this.handleRingCollected(ring, workoutStatus),
      (gem) => this.handleGemCollected(gem, workoutStatus)
    );

    // Follow Camera
    const cameraTargetPos = new THREE.Vector3(
      0,
      this.position.y + 2.5,
      this.position.z - 7.5
    );
    this.camera.position.lerp(cameraTargetPos, delta * 7.0);

    const lookAtTarget = new THREE.Vector3(
      0,
      this.position.y + 1.2,
      this.position.z + 18
    );
    this.camera.lookAt(lookAtTarget);

    // Calories
    const calPerSecond = (0.12 + (this.currentCadence / 100) * 0.2);
    this.calories += calPerSecond * delta;

    // HUD Update
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
        maxRpm: this.maxRpmRecorded,
        gameState: this.state
      });
    }
  }

  handleRingCollected(ring, workoutStatus) {
    let phaseMultiplier = 1.0;
    if (workoutStatus.isSprint) {
      phaseMultiplier = workoutStatus.isMeetingTarget ? 3.0 : 1.5;
    }

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
