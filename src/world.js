import * as THREE from 'three';

/**
 * 3D Procedural World for SkyGame: Helibike
 * Rings and bonuses are aligned along X = 0.
 * Altitude matches the current workout phase target RPM:
 * - Warmup/Recovery (~55-60 RPM): rings at 34m - 42m
 * - Sprint Phase (Target RPM 75, 90, 105+): golden rings at the sprint altitude!
 */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
    this.gems = [];
    this.clouds = [];
    this.islands = [];

    this.spawnDistanceZ = 350;
    this.recycleDistanceZ = 35;
    this.nextSpawnZ = 25;

    this.ringGeometries = {
      bronze: new THREE.TorusGeometry(3.8, 0.4, 16, 32),
      silver: new THREE.TorusGeometry(3.8, 0.4, 16, 32),
      gold: new THREE.TorusGeometry(4.2, 0.5, 16, 32)
    };

    this.ringMaterials = {
      bronze: new THREE.MeshStandardMaterial({
        color: 0xcd7f32,
        emissive: 0x8b4513,
        emissiveIntensity: 0.45,
        metalness: 0.8,
        roughness: 0.3
      }),
      silver: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        emissive: 0x94a3b8,
        emissiveIntensity: 0.55,
        metalness: 0.9,
        roughness: 0.2
      }),
      gold: new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.9,
        metalness: 0.9,
        roughness: 0.15
      })
    };

    this.gemGeo = new THREE.OctahedronGeometry(1.0);
    this.gemMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      metalness: 0.2,
      roughness: 0.1
    });

    this.goldGemMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 1.0,
      metalness: 0.4,
      roughness: 0.1
    });

    this.initSkyAndLighting();
    this.initInitialWorld();
  }

  initSkyAndLighting() {
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0032);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x38bdf8, 0.85);
    hemiLight.position.set(0, 120, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    sunLight.position.set(100, 180, 80);
    sunLight.castShadow = true;
    this.scene.add(sunLight);
  }

  calcAltitudeForRpm(rpm) {
    if (rpm <= 30) return 18;
    const norm = Math.min(1.0, (rpm - 30) / 90.0);
    return 18 + Math.pow(norm, 1.15) * 102;
  }

  initInitialWorld() {
    while (this.nextSpawnZ < this.spawnDistanceZ) {
      this.spawnSegment(this.nextSpawnZ, false, 55);
      this.nextSpawnZ += 24;
    }
  }

  spawnSegment(z, isSprint = false, targetRpm = 60) {
    const x = 0; // Centered along flight path
    const baseAltitude = this.calcAltitudeForRpm(targetRpm);

    let type = 'silver';
    let y = baseAltitude;
    let points = 150;

    if (isSprint) {
      type = 'gold';
      y = baseAltitude + (Math.random() - 0.5) * 6; // Around target sprint altitude
      points = 600;
    } else {
      const rand = Math.random();
      if (rand < 0.35) {
        type = 'bronze';
        y = baseAltitude - 5 + (Math.random() - 0.5) * 4;
        points = 80;
      } else {
        type = 'silver';
        y = baseAltitude + (Math.random() - 0.5) * 4;
        points = 180;
      }
    }

    // 1. Ring centered at X = 0
    const ringMesh = new THREE.Mesh(this.ringGeometries[type], this.ringMaterials[type]);
    ringMesh.position.set(x, y, z);
    this.scene.add(ringMesh);

    this.rings.push({
      mesh: ringMesh,
      type,
      points,
      x,
      y,
      z,
      radius: 4.0,
      collected: false
    });

    // 2. Floating Gems/Crystals
    const gemCount = isSprint ? 4 : 2;
    for (let i = 0; i < gemCount; i++) {
      const mat = isSprint ? this.goldGemMat : this.gemMat;
      const gemMesh = new THREE.Mesh(this.gemGeo, mat);
      const gz = z + 4 + i * 4.5;
      const gy = y + (Math.random() - 0.5) * 2;
      gemMesh.position.set(0, gy, gz);
      this.scene.add(gemMesh);

      this.gems.push({
        mesh: gemMesh,
        collected: false,
        points: isSprint ? 80 : 30
      });
    }

    // 3. Clouds
    if (Math.random() < 0.7) {
      const side = Math.random() > 0.5 ? 45 : -45;
      this.spawnCloud(side + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 15, z);
    }

    // 4. Floating Islands below
    if (Math.random() < 0.45) {
      const side = Math.random() > 0.5 ? 55 : -55;
      this.spawnIsland(side + (Math.random() - 0.5) * 25, Math.max(-15, y - 45), z);
    }
  }

  spawnCloud(x, y, z) {
    const cloudGroup = new THREE.Group();
    const puffGeo = new THREE.DodecahedronGeometry(7 + Math.random() * 6, 1);
    const puffMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      transparent: true,
      opacity: 0.88
    });

    const puffs = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < puffs; i++) {
      const p = new THREE.Mesh(puffGeo, puffMat);
      p.position.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 14
      );
      const scale = 0.6 + Math.random() * 0.7;
      p.scale.set(scale, scale * 0.6, scale);
      cloudGroup.add(p);
    }

    cloudGroup.position.set(x, y, z);
    this.scene.add(cloudGroup);
    this.clouds.push(cloudGroup);
  }

  spawnIsland(x, y, z) {
    const islandGroup = new THREE.Group();

    const rockGeo = new THREE.ConeGeometry(22 + Math.random() * 10, 40, 7);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9, flatShading: true });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.rotation.x = Math.PI;
    rock.position.y = -20;
    islandGroup.add(rock);

    const grassGeo = new THREE.CylinderGeometry(22 + Math.random() * 10, 20, 3, 7);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.7, flatShading: true });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.position.y = 1;
    islandGroup.add(grass);

    islandGroup.position.set(x, y, z);
    this.scene.add(islandGroup);
    this.islands.push(islandGroup);
  }

  update(delta, playerPos, isSprintPhase, targetRpm, onCollectRing, onCollectGem) {
    // 1. Check rings collision
    for (const r of this.rings) {
      if (!r.collected) {
        r.mesh.rotation.z += delta * (isSprintPhase ? 2.5 : 1.2);

        const distZ = Math.abs(playerPos.z - r.z);
        if (distZ < 3.2) {
          const distY = Math.abs(playerPos.y - r.y);
          if (distY <= r.radius + 1.2) {
            r.collected = true;
            this.animateRingCollection(r.mesh);
            if (onCollectRing) onCollectRing(r);
          }
        }
      }
    }

    // 2. Check gems collision
    for (const g of this.gems) {
      if (!g.collected) {
        g.mesh.rotation.y += delta * 2.8;

        const distZ = Math.abs(playerPos.z - g.mesh.position.z);
        if (distZ < 2.8) {
          const distY = Math.abs(playerPos.y - g.mesh.position.y);
          if (distY < 3.2) {
            g.collected = true;
            this.scene.remove(g.mesh);
            if (onCollectGem) onCollectGem(g);
          }
        }
      }
    }

    // 3. Recycle & Spawn ahead
    while (this.nextSpawnZ < playerPos.z + this.spawnDistanceZ) {
      this.spawnSegment(this.nextSpawnZ, isSprintPhase, targetRpm);
      this.nextSpawnZ += isSprintPhase ? 18 : 24;
    }

    const minZ = playerPos.z - this.recycleDistanceZ;

    this.rings = this.rings.filter((r) => {
      if (r.z < minZ) {
        this.scene.remove(r.mesh);
        return false;
      }
      return true;
    });

    this.gems = this.gems.filter((g) => {
      if (g.mesh.position.z < minZ) {
        this.scene.remove(g.mesh);
        return false;
      }
      return true;
    });

    this.clouds = this.clouds.filter((c) => {
      if (c.position.z < minZ) {
        this.scene.remove(c);
        return false;
      }
      return true;
    });

    this.islands = this.islands.filter((isl) => {
      if (isl.position.z < minZ) {
        this.scene.remove(isl);
        return false;
      }
      return true;
    });
  }

  animateRingCollection(mesh) {
    let progress = 0;
    const originalScale = mesh.scale.clone();

    const anim = () => {
      progress += 0.08;
      mesh.scale.set(
        originalScale.x * (1 + progress * 0.9),
        originalScale.y * (1 + progress * 0.9),
        originalScale.z * (1 + progress * 0.3)
      );
      if (progress < 1.0) {
        requestAnimationFrame(anim);
      } else {
        this.scene.remove(mesh);
      }
    };
    anim();
  }
}
