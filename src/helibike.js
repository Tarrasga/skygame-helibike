import * as THREE from 'three';

/**
 * 3D Procedural Helibike Model for SkyGame
 * Inspired by Cyberbike (Nintendo Wii) and futuristic flight vehicles.
 */
export class Helibike {
  constructor() {
    this.mesh = new THREE.Group();
    this.rotorGroup = new THREE.Group();
    this.tailRotorGroup = new THREE.Group();
    this.pedalGroup = new THREE.Group();
    this.wheels = [];

    this.rotorAngle = 0;
    this.tailRotorAngle = 0;
    this.pedalAngle = 0;
    this.wheelAngle = 0;

    this.trailParticles = null;
    this.trailGeo = null;

    this.createModel();
    this.createParticleTrails();
  }

  createModel() {
    // Materials
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2
    });

    const cyberOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xff6b00,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0xff3b00,
      emissiveIntensity: 0.2
    });

    const neonCyanMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.4,
      roughness: 0.2,
      emissive: 0x00d8ff,
      emissiveIntensity: 0.5
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xdde4ec,
      metalness: 0.9,
      roughness: 0.1
    });

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.7,
      roughness: 0.3
    });

    const windshieldMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.85,
      transparent: true,
      opacity: 0.8
    });

    // 1. Central Aero Monocoque Frame
    const frameGeo = new THREE.BoxGeometry(0.35, 0.45, 1.8);
    const frame = new THREE.Mesh(frameGeo, cyberOrangeMat);
    frame.position.set(0, 0.7, 0);
    this.mesh.add(frame);

    // Streamlined top spine
    const spineGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.9, 16);
    const spine = new THREE.Mesh(spineGeo, carbonMat);
    spine.rotation.x = Math.PI / 2;
    spine.position.set(0, 0.95, 0);
    this.mesh.add(spine);

    // 2. Wheels (Aero Flight Skids & Gyro Wheels)
    const wheelGeo = new THREE.TorusGeometry(0.42, 0.08, 16, 32);
    const rimMat = neonCyanMat;

    // Front Wheel
    const frontWheel = new THREE.Mesh(wheelGeo, rimMat);
    frontWheel.position.set(0, 0.42, 0.95);
    this.mesh.add(frontWheel);
    this.wheels.push(frontWheel);

    // Rear Wheel
    const rearWheel = new THREE.Mesh(wheelGeo, rimMat);
    rearWheel.position.set(0, 0.42, -0.95);
    this.mesh.add(rearWheel);
    this.wheels.push(rearWheel);

    // Forks & Struts
    const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8);
    const frontFork = new THREE.Mesh(strutGeo, chromeMat);
    frontFork.position.set(0, 0.55, 0.85);
    frontFork.rotation.x = 0.3;
    this.mesh.add(frontFork);

    const rearFork = new THREE.Mesh(strutGeo, chromeMat);
    rearFork.position.set(0, 0.55, -0.85);
    rearFork.rotation.x = -0.3;
    this.mesh.add(rearFork);

    // 3. Handlebars and Aero Cockpit Screen
    const barGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.85);
    const bar = new THREE.Mesh(barGeo, carbonMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.15, 0.6);
    this.mesh.add(bar);

    // Flight Grips
    const gripGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.18);
    const leftGrip = new THREE.Mesh(gripGeo, cyberOrangeMat);
    leftGrip.position.set(-0.4, 1.15, 0.6);
    leftGrip.rotation.z = Math.PI / 2;
    this.mesh.add(leftGrip);

    const rightGrip = new THREE.Mesh(gripGeo, cyberOrangeMat);
    rightGrip.position.set(0.4, 1.15, 0.6);
    rightGrip.rotation.z = Math.PI / 2;
    this.mesh.add(rightGrip);

    // Windshield
    const windshieldGeo = new THREE.ConeGeometry(0.3, 0.6, 16, 1, true, 0, Math.PI);
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    windshield.position.set(0, 1.25, 0.7);
    windshield.rotation.x = -0.8;
    this.mesh.add(windshield);

    // Saddle / Pilot Seat
    const seatGeo = new THREE.BoxGeometry(0.26, 0.1, 0.45);
    const seat = new THREE.Mesh(seatGeo, carbonMat);
    seat.position.set(0, 0.95, -0.2);
    this.mesh.add(seat);

    // 4. Pedal Crankset
    const crankGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5);
    const crank = new THREE.Mesh(crankGeo, chromeMat);
    crank.rotation.z = Math.PI / 2;
    this.pedalGroup.position.set(0, 0.45, 0);
    this.pedalGroup.add(crank);

    // Left & Right Pedals
    const pedalArmL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.05), chromeMat);
    pedalArmL.position.set(-0.25, 0.1, 0);
    this.pedalGroup.add(pedalArmL);

    const pedalArmR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.05), chromeMat);
    pedalArmR.position.set(0.25, -0.1, 0);
    this.pedalGroup.add(pedalArmR);

    this.mesh.add(this.pedalGroup);

    // 5. Overhead Helicopter Rotor Mast & Hub
    const mastGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.0, 16);
    const mast = new THREE.Mesh(mastGeo, carbonMat);
    mast.position.set(0, 1.45, 0);
    this.mesh.add(mast);

    // Rotor Hub
    this.rotorGroup.position.set(0, 1.95, 0);

    const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16);
    const hub = new THREE.Mesh(hubGeo, chromeMat);
    this.rotorGroup.add(hub);

    // 3 Aerodynamic Helicopter Blades
    const bladeGeo = new THREE.BoxGeometry(0.18, 0.02, 1.4);
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(Math.sin(angle) * 0.75, 0, Math.cos(angle) * 0.75);
      blade.rotation.y = angle;
      blade.rotation.x = 0.08; // pitch angle for lift!

      // Glowing tip
      const tipGeo = new THREE.BoxGeometry(0.19, 0.025, 0.2);
      const tip = new THREE.Mesh(tipGeo, neonCyanMat);
      tip.position.set(0, 0, 0.65);
      blade.add(tip);

      this.rotorGroup.add(blade);
    }

    // Motion Blur Propeller Disc (transparent, visible at high RPM)
    const blurDiscGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.02, 32);
    const blurDiscMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0
    });
    this.blurDisc = new THREE.Mesh(blurDiscGeo, blurDiscMat);
    this.rotorGroup.add(this.blurDisc);

    this.mesh.add(this.rotorGroup);

    // 6. Tail Boom & Mini Tail Rotor
    const boomGeo = new THREE.CylinderGeometry(0.04, 0.08, 1.3, 12);
    const boom = new THREE.Mesh(boomGeo, carbonMat);
    boom.rotation.x = Math.PI / 2 + 0.15;
    boom.position.set(0, 0.95, -1.35);
    this.mesh.add(boom);

    // Tail Fin
    const finGeo = new THREE.BoxGeometry(0.04, 0.5, 0.35);
    const fin = new THREE.Mesh(finGeo, cyberOrangeMat);
    fin.position.set(0, 1.15, -1.95);
    fin.rotation.x = -0.4;
    this.mesh.add(fin);

    // Tail Rotor
    this.tailRotorGroup.position.set(0.06, 1.25, -2.05);
    const tailBladeGeo = new THREE.BoxGeometry(0.04, 0.45, 0.015);
    const tailBlade1 = new THREE.Mesh(tailBladeGeo, neonCyanMat);
    const tailBlade2 = new THREE.Mesh(tailBladeGeo, neonCyanMat);
    tailBlade2.rotation.z = Math.PI / 2;
    this.tailRotorGroup.add(tailBlade1);
    this.tailRotorGroup.add(tailBlade2);
    this.mesh.add(this.tailRotorGroup);

    // 7. Jet Thruster Nozzles (emit glowing exhaust)
    const thrusterGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.3, 16);
    const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9 });

    const leftThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    leftThruster.rotation.x = Math.PI / 2;
    leftThruster.position.set(-0.24, 0.65, -0.85);
    this.mesh.add(leftThruster);

    const rightThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    rightThruster.rotation.x = Math.PI / 2;
    rightThruster.position.set(0.24, 0.65, -0.85);
    this.mesh.add(rightThruster);

    // Cast shadows
    this.mesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.mesh.scale.set(1.1, 1.1, 1.1);
  }

  createParticleTrails() {
    const particleCount = 60;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = 0.65 + (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 2] = -0.9 - Math.random() * 2.0;

      // Cyan / Orange glow
      colors[i * 3] = 0.0;
      colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.trailParticles = new THREE.Points(geometry, material);
    this.mesh.add(this.trailParticles);
  }

  /**
   * Update Helibike animations based on RPM, forward speed, and steering roll
   * steerRate: -1 for full LEFT, +1 for full RIGHT
   */
  update(delta, cadenceRpm, forwardSpeed, steerRate, isSprint) {
    // 1. Rotor spin
    const targetRPS = Math.max(cadenceRpm / 60, 0.5);
    const rotorSpeed = targetRPS * Math.PI * 2 * 2.5;
    this.rotorAngle += rotorSpeed * delta;
    this.rotorGroup.rotation.y = this.rotorAngle;

    // Tail rotor
    this.tailRotorAngle += rotorSpeed * 2.5 * delta;
    this.tailRotorGroup.rotation.x = this.tailRotorAngle;

    // Pedal crank
    const pedalSpeed = (cadenceRpm / 60) * Math.PI * 2;
    this.pedalAngle += pedalSpeed * delta;
    this.pedalGroup.rotation.x = this.pedalAngle;

    // Motion blur propeller disc
    if (this.blurDisc) {
      const targetOpacity = THREE.MathUtils.clamp((cadenceRpm - 40) / 60, 0, 0.45);
      this.blurDisc.material.opacity = THREE.MathUtils.lerp(
        this.blurDisc.material.opacity,
        targetOpacity,
        delta * 5
      );
    }

    // Wheels rotation
    this.wheelAngle += forwardSpeed * delta * 2;
    for (const wheel of this.wheels) {
      wheel.rotation.x = this.wheelAngle;
    }

    // 2. Flight banking & aerodynamic pitch
    // Bank (roll) into the turn:
    // When steerRate < 0 (LEFT): lean left (positive Z rotation in Three.js)
    // When steerRate > 0 (RIGHT): lean right (negative Z rotation in Three.js)
    const targetRoll = -steerRate * 0.45;
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetRoll, delta * 6);

    // Yaw heading:
    // When steerRate < 0 (LEFT): nose points left (negative Y rotation)
    // When steerRate > 0 (RIGHT): nose points right (positive Y rotation)
    const targetYaw = -steerRate * 0.22;
    this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetYaw, delta * 5);

    // Pitch: nose up when climbing (high RPM), nose slightly down when diving/gliding
    const verticalRate = (cadenceRpm - 60) / 40;
    const targetPitch = THREE.MathUtils.clamp(-verticalRate * 0.12, -0.3, 0.25);
    this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, targetPitch, delta * 4);

    // Hover float micro-wobble
    const time = performance.now() * 0.003;
    const hoverWobble = Math.sin(time) * 0.04;
    this.mesh.position.y += hoverWobble * delta;

    // 3. Particle Exhaust update
    if (this.trailParticles) {
      const positions = this.trailParticles.geometry.attributes.position.array;
      const count = positions.length / 3;

      for (let i = 0; i < count; i++) {
        positions[i * 3 + 2] -= (10.0 + forwardSpeed * 0.5) * delta;
        if (positions[i * 3 + 2] < -3.5) {
          const side = Math.random() > 0.5 ? 0.24 : -0.24;
          positions[i * 3] = side + (Math.random() - 0.5) * 0.08;
          positions[i * 3 + 1] = 0.65 + (Math.random() - 0.5) * 0.08;
          positions[i * 3 + 2] = -0.85;
        }
      }
      this.trailParticles.geometry.attributes.position.needsUpdate = true;
      this.trailParticles.material.opacity = isSprint ? 0.9 : 0.35;
      this.trailParticles.material.size = isSprint ? 0.2 : 0.1;
    }
  }
}
