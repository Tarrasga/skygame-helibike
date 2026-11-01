import * as THREE from 'three';
import { Helibike } from './helibike.js';
import { World } from './world.js';
import { AudioManager } from './audio.js';
import { BluetoothManager } from './bluetooth.js';

export class Game {
  constructor(container) {
    this.container = container;

    // Core Components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.helibike = null;
    this.world = null;
    this.audio = new AudioManager();
    this.bluetooth = new BluetoothManager();

    // Flight Physics State
    this.position = new THREE.Vector3(0, 35, 0);
    this.velocity = new THREE.Vector3(0, 0, 18); // forward m/s
    this.steerInput = 0;
    this.steerVelocity = 0;

    // Bike Data State
    this.currentCadence = 0;
    this.targetCadence = 0;
    this.currentSpeedKmh = 0;
    this.currentPowerWatts = 0;
    this.currentHeartRate = null;

    // Simulation / Demo Mode
    this.isSimulated = false;
    this.simRpm = 65;

    // Game Progression & Stats
    this.score = 0;
    this.combo = 1;
    this.distanceMeters = 0;
    this.calories = 0;
    this.totalSeconds = 0;
    this.thermalBoostTimer = 0;

    // Controls
    this.keys = {};
    this.touchSteer = 0;

    // Callbacks for UI updates
    this.onHUDUpdate = null;

    this.initThree();
    this.initControls();
    this.initBluetoothCallbacks();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x38bdf8); // Sky Blue

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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // Add Helibike and World
    this.helibike = new Helibike();
    this.scene.add(this.helibike.mesh);

    this.world = new World(this.scene);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initControls() {
    // Keyboard controls (A/Left Arrow for Left, D/Right Arrow for Right, W/S for RPM)
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      this.audio.resume();

      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        this.simRpm = Math.min(130, this.simRpm + 5);
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        this.simRpm = Math.max(0, this.simRpm - 5);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Device Tilt / Gyroscope support
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma !== null && Math.abs(e.gamma) > 4) {
          this.gyroSteer = THREE.MathUtils.clamp(-e.gamma / 25, -1, 1);
        } else {
          this.gyroSteer = 0;
        }
      });
    }
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

  setTouchSteer(direction) {
    this.touchSteer = direction;
    this.audio.resume();
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

    // 1. Cadence & Speed Determination
    if (this.isSimulated || (!this.bluetooth.bikeDevice && this.targetCadence === 0)) {
      this.targetCadence = this.simRpm;
      this.currentSpeedKmh = (this.targetCadence / 80) * 30;
    }

    this.currentCadence = THREE.MathUtils.lerp(this.currentCadence, this.targetCadence, delta * 3.5);

    // 2. Flight Dynamics & Altitude Physics
    const baseRpm = 55.0;
    const rpmDifference = this.currentCadence - baseRpm;

    let verticalThrust = 0;
    if (rpmDifference > 0) {
      verticalThrust = (rpmDifference / 45.0) * 16.0;
    } else {
      verticalThrust = (rpmDifference / 45.0) * 9.0;
    }

    if (this.thermalBoostTimer > 0) {
      this.thermalBoostTimer -= delta;
      verticalThrust += 18.0;
    }

    // Forward speed (m/s)
    const forwardSpeed = 12.0 + (this.currentCadence / 100.0) * 14.0;
    this.velocity.z = forwardSpeed;

    // Steer Input Resolution (Swapped direction as requested so Left turns Left, Right turns Right)
    let steer = this.touchSteer;
    if (this.keys['a'] || this.keys['arrowleft']) steer += 1;
    if (this.keys['d'] || this.keys['arrowright']) steer -= 1;
    if (this.gyroSteer) steer += this.gyroSteer;
    this.steerInput = THREE.MathUtils.clamp(steer, -1, 1);

    // Smooth lateral movement: positive moves left, negative moves right
    this.steerVelocity = THREE.MathUtils.lerp(this.steerVelocity, -this.steerInput * 18.0, delta * 5.0);

    // Update Position
    this.position.x += this.steerVelocity * delta;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -50, 50);

    this.position.y += verticalThrust * delta;
    this.position.y = THREE.MathUtils.clamp(this.position.y, 6, 140);

    this.position.z += this.velocity.z * delta;
    this.distanceMeters = this.position.z;

    this.helibike.mesh.position.copy(this.position);

    const isSprint = this.currentCadence > 85;
    this.helibike.update(delta, this.currentCadence, forwardSpeed, this.steerInput, isSprint);

    // 3. Audio & Propeller Hum
    this.audio.updatePropeller(this.currentCadence);

    // 4. Update 3D World (Rings, Gems, Clouds, Collisions)
    this.world.update(
      delta,
      this.position,
      (ring) => this.handleRingCollected(ring),
      (gem) => this.handleGemCollected(gem),
      () => this.handleThermalEntered()
    );

    // 5. Follow Camera
    const cameraTargetPos = new THREE.Vector3(
      this.position.x * 0.85,
      this.position.y + 2.8,
      this.position.z - 7.8
    );
    this.camera.position.lerp(cameraTargetPos, delta * 7.5);

    const lookAtTarget = new THREE.Vector3(
      this.position.x,
      this.position.y + 1.2,
      this.position.z + 16
    );
    this.camera.lookAt(lookAtTarget);

    // 6. Calories Calculation
    const calPerSecond = (0.1 + (this.currentCadence / 100) * 0.18);
    this.calories += calPerSecond * delta;

    // 7. HUD notification
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
        isSprint,
        thermalActive: this.thermalBoostTimer > 0
      });
    }
  }

  handleRingCollected(ring) {
    let hrMultiplier = 1.0;
    if (this.currentHeartRate && this.currentHeartRate.zone.level >= 3) {
      hrMultiplier = 1.5;
    }

    const earned = Math.round(ring.points * this.combo * hrMultiplier);
    this.score += earned;
    this.combo = Math.min(10, this.combo + 1);

    this.audio.playRingChime(ring.type);
  }

  handleGemCollected(gem) {
    this.score += gem.points;
    this.audio.playGemChime();
  }

  handleThermalEntered() {
    this.thermalBoostTimer = 3.5;
    this.audio.playThermalWhoosh();
  }
}
