import * as THREE from 'three';

/**
 * 3D Procedural World for SkyGame: Helibike (Interval & Sprint Mode)
 * Rings and bonuses are aligned along the forward path (X = 0).
 * Altitude varies with pedaling cadence:
 * - Warmup/Recovery: Cruising rings at 25m - 45m
 * - Sprint Phase: Rich cascades of Golden Rings & Gems at 65m - 110m!
 */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
    this.gems = [];
    this.clouds = [];
    this.islands = [];
    this.thermals = [];

    this.spawnDistanceZ = 350;
    this.recycleDistanceZ = 40;
    this.nextSpawnZ = 30;

    this.ringGeometries = {
      bronze: new THREE.TorusGeometry(3.6, 0.4, 16, 32),
      silver: new THREE.TorusGeometry(3.6, 0.4, 16, 32),
      gold: new THREE.TorusGeometry(3.8, 0.45, 16, 32)
    };

    this.ringMaterials = {
      bronze: new THREE.MeshStandardMaterial({
        color: 0xcd7f32,
        emissive: 0x8b4513,
        emissiveIntensity: 0.4,
        metalness: 0.8,
        roughness: 0.3
      }),
      silver: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        emissive: 0x94a3b8,
        emissiveIntensity: 0.5,
        metalness: 0.9,
        roughness: 0.2
      }),
      gold: new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.8,
        metalness: 0.9,
        roughness: 0.15
      })
    };

    this.gemGeo = new THREE.OctahedronGeometry(0.9);
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
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 400;
    this.scene.add(sunLight);
  }

  initInitialWorld() {
    while (this.nextSpawnZ < this.spawnDistanceZ) {
      this.spawnSegment(this.nextSpawnZ, false);
      this.nextSpawnZ += 24;
    }
  }

  spawnSegment(z, isSprint = false) {
    // Aligned directly along the central path X = 0 (no lateral steering needed)
    const x = 0;

    let type = 'silver';
    let y = 35;
    let points = 150;

    if (isSprint) {
      // SPRINT PHASE: Golden rings at high altitude (65m to 105m)
      type = 'gold';
      y = 70 + Math.random() * 30; // High sprint altitude!
      points = 600;
    } else {
      // Warmup / Recovery: regular altitude (25m to 45m)
      const rand = Math.random();
      if (rand < 0.4) {
        type = 'bronze';
        y = 22 + Math.random() * 10;
        points = 80;
      } else {
        type = 'silver';
        y = 35 + Math.random() * 15;
        points = 180;
      }
    }

    // 1. Spawn Ring centered at X = 0
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
      radius: 3.6,
      collected: false
    });

    // 2. Spawn Floating Crystals / Gems leading into or past the ring
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

    // 3. Clouds at various altitudes on sides
    if (Math.random() < 0.7) {
      const side = Math.random() > 0.5 ? 45 : -45;
      this.spawnCloud(side + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 20, z);
    }

    // 4. Floating Islands below
    if (Math.random() < 0.5) {
      const side = Math.random() > 0.5 ? 55 : -55;
      this.spawnIsland(side + (Math.random() - 0.5) * 25, -12 + Math.random() * 10, z);
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

    // Tree
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4, 5), new THREE.MeshStandardMaterial({ color: 0x78350f }));
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3, 6, 5), new THREE.MeshStandardMaterial({ color: 0x15803d, flatShading: true }));
    leaves.position.y = 4;
    const tree = new THREE.Group();
    tree.add(trunk);
    tree.add(leaves);
    tree.position.set(0, 3, 0);
    islandGroup.add(tree);

    islandGroup.position.set(x, y, z);
    this.scene.add(islandGroup);
    this.islands.push(islandGroup);
  }

  /**
   * Update world objects, recycle passed elements, check player collisions along X = 0
   */
  update(delta, playerPos, isSprintPhase, onCollectRing, onCollectGem) {
    // 1. Rotate rings and check collision (altitude-based)
    for (const r of this.rings) {
      if (!r.collected) {
        r.mesh.rotation.z += delta * (isSprintPhase ? 2.5 : 1.2);

        const distZ = Math.abs(playerPos.z - r.z);
        if (distZ < 3.0) {
          const distY = Math.abs(playerPos.y - r.y);
          if (distY <= r.radius + 1.2) {
            r.collected = true;
            this.animateRingCollection(r.mesh);
            if (onCollectRing) onCollectRing(r);
          }
        }
      }
    }

    // 2. Rotate gems and check collision
    for (const g of this.gems) {
      if (!g.collected) {
        g.mesh.rotation.y += delta * 2.8;
        g.mesh.rotation.x += delta * 1.5;

        const distZ = Math.abs(playerPos.z - g.mesh.position.z);
        if (distZ < 2.5) {
          const distY = Math.abs(playerPos.y - g.mesh.position.y);
          if (distY < 3.0) {
            g.collected = true;
            this.scene.remove(g.mesh);
            if (onCollectGem) onCollectGem(g);
          }
        }
      }
    }

    // 3. Recycle and spawn new segments ahead
    while (this.nextSpawnZ < playerPos.z + this.spawnDistanceZ) {
      this.spawnSegment(this.nextSpawnZ, isSprintPhase);
      this.nextSpawnZ += isSprintPhase ? 18 : 24; // Tighter ring clusters during sprint!
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
