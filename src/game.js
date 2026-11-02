import * as THREE from 'three';
import { Helibike } from './helibike.js';
import { World } from './world.js';
import { BluetoothManager } from './bluetooth.js';
import { AudioManager } from './audio.js';
import { WorkoutManager } from './workout.js';
import { RankingManager } from './ranking.js';

export class Game {
  constructor(container) {
    this.container = container;

    // Subsystems
    this.bluetooth = new BluetoothManager();
    this.audio = new AudioManager();
    this.workout = new WorkoutManager('normal');
    this.ranking = new RankingManager();

    // Game State: 'menu' | 'playing' | 'paused'
    this.state = 'menu';

    // Physics & Helibike State
    this.position = new THREE.Vector3(0, 14, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Bike Data State (starts strictly at 0 when no bike connected)
    this.currentCadence = 0;
    this.targetCadence = 0;
    this.currentSpeedKmh = 0;
    this.currentPowerWatts = 0;
    this.maxRpmRecorded = 0;
    this.lastBikeDataTime = 0;

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
      this.currentPowerWatts = data.power || 0;
      this.lastBikeDataTime = performance.now();
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
    this.position.set(0, 14, 0);
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
    // 1. MENU STATE: Cinematic Showcase in Hangar
    if (this.state === 'menu') {
      const time = performance.now() * 0.001;
      this.helibike.mesh.position.set(0, 36 + Math.sin(time * 1.5) * 0.5, 0);
      this.helibike.mesh.rotation.y = Math.sin(time * 0.6) * 0.35;
      this.helibike.mesh.rotation.z = Math.sin(time * 1.2) * 0.06;

      // Gentle rotor idle spin
      this.helibike.update(delta, 35, 0, false);

      // Camera views the Helibike smoothly from front/side
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

    // 3. PLAYING STATE: Flight Simulation
    this.totalSeconds += delta;

    // Cadence & Speed Determination:
    // If not connected to bike and not simulated -> SPEED AND CADENCE ARE STRICTLY 0!
    if (this.isSimulated) {
      this.targetCadence = this.simRpm;
      if (this.targetCadence > 0) {
        // Minimum speed 18 km/h, increasing with RPM
        this.currentSpeedKmh = 18.0 + Math.max(0, (this.targetCadence - 20) * 0.35);
      } else {
        this.currentSpeedKmh = 0;
      }
    } else if (!this.bluetooth.bikeDeviceId) {
      // No bike connected -> 0 RPM & 0 KM/H
      this.targetCadence = 0;
      this.currentSpeedKmh = 0;
    } else {
      // Connected to bike: watchdog for inactivity (player stopped pedaling)
      const secondsSinceData = (performance.now() - this.lastBikeDataTime) / 1000;
      if (secondsSinceData > 2.5) {
        this.targetCadence = 0;
        this.currentSpeedKmh = 0;
      }
    }

    // Smooth cadence interpolation
    this.currentCadence = THREE.MathUtils.lerp(this.currentCadence, this.targetCadence, delta * 3.5);

    // If cadence dropped to near zero, snap to 0
    if (this.currentCadence < 2.0 && this.targetCadence === 0) {
      this.currentCadence = 0;
      this.currentSpeedKmh = 0;
    }

    if (this.currentCadence > this.maxRpmRecorded) {
      this.maxRpmRecorded = Math.round(this.currentCadence);
    }

    // Workout Intervals advancement
    this.workout.update(delta);
    const workoutStatus = this.workout.getStatus(Math.round(this.currentCadence));

    // Calculate Speed:
    // "a velocidade minima tem que ser 18km/h e indo aumentando. quando naoo tiver ligacao a bike a velocidade fica a 0"
    let displaySpeedKmh = 0;
    let forwardSpeedMps = 0;

    if (this.currentCadence > 5) {
      const baseSpeed = 18.0;
      const rpmIncrease = Math.max(0, (this.currentCadence - 20) * 0.35);
      displaySpeedKmh = Math.round((baseSpeed + rpmIncrease) * 10) / 10;
      forwardSpeedMps = displaySpeedKmh / 3.6;
    } else {
      displaySpeedKmh = 0;
      forwardSpeedMps = 0;
    }

    // Advance distance along Z
    this.velocity.z = forwardSpeedMps;
    this.position.z += this.velocity.z * delta;
    this.distanceMeters = this.position.z;

    // Flight Altitude (Aerodynamic lift from RPM):
    // When stopped (0 RPM), Helibike glides to ground runway level (y = 12)
    let targetAltitude = 12;
    if (this.currentCadence > 25) {
      const norm = Math.min(1.0, (this.currentCadence - 25) / 95.0);
      targetAltitude = 18 + Math.pow(norm, 1.15) * 102;
    }

    this.position.y = THREE.MathUtils.lerp(this.position.y, targetAltitude, delta * 2.8);
    this.position.x = 0;

    this.helibike.mesh.position.copy(this.position);

    const isSprint = workoutStatus.isSprint && workoutStatus.isMeetingTarget;
    this.helibike.update(delta, this.currentCadence, forwardSpeedMps, isSprint);

    // Propeller audio
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

    // Calories: only increment when actively pedaling
    if (this.currentCadence > 10) {
      const calPerSecond = (0.10 + (this.currentCadence / 100) * 0.18);
      this.calories += calPerSecond * delta;
    }

    // HUD Update
    if (this.onHUDUpdate) {
      this.onHUDUpdate({
        cadence: Math.round(this.currentCadence),
        speed: Math.round(displaySpeedKmh),
        altitude: Math.round(this.position.y),
        score: this.score,
        combo: this.combo,
        distanceKm: (this.distanceMeters / 1000).toFixed(2),
        calories: Math.round(this.calories),
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

    this.score += Math.round(100 * phaseMultiplier * this.combo);
    this.combo = Math.min(8, this.combo + 1);
    this.audio.playRingSound();
  }

  handleGemCollected(gem, workoutStatus) {
    let phaseMultiplier = 1.0;
    if (workoutStatus.isSprint) {
      phaseMultiplier = workoutStatus.isMeetingTarget ? 3.0 : 1.5;
    }

    this.score += Math.round(250 * phaseMultiplier * this.combo);
    this.audio.playGemSound();
  }
}
