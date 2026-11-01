import * as THREE from 'three';

/**
 * 3D Procedural World for SkyGame: Helibike
 * Generates an endless skyway with floating islands, clouds, scoring rings, and thermal updrafts.
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
      bronze: new THREE.TorusGeometry(3.2, 0.35, 16, 32),
      silver: new THREE.TorusGeometry(3.2, 0.35, 16, 32),
      gold: new THREE.TorusGeometry(3.4, 0.4, 16, 32)
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
        emissiveIntensity: 0.7,
        metalness: 0.9,
        roughness: 0.15
      })
    };

    this.gemGeo = new THREE.OctahedronGeometry(0.8);
    this.gemMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      metalness: 0.2,
      roughness: 0.1
    });

    this.initSkyAndLighting();
    this.initInitialWorld();
  }

  initSkyAndLighting() {
    // Atmospheric Fog
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0035);

    // Ambient Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x38bdf8, 0.8);
    hemiLight.position.set(0, 100, 0);
    this.scene.add(hemiLight);

    // Directional Sunlight
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.3);
    sunLight.position.set(120, 180, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    this.scene.add(sunLight);
  }

  initInitialWorld() {
    // Pre-populate forward track
    while (this.nextSpawnZ < this.spawnDistanceZ) {
      this.spawnSegment(this.nextSpawnZ);
      this.nextSpawnZ += 28 + Math.random() * 12;
    }
  }

  spawnSegment(z) {
    // 1. Determine Ring Tier & Altitude:
    // Low: 12-25m (Bronze: Glide/recovery)
    // Mid: 35-55m (Silver: Cruise)
    // High: 70-110m (Gold: High Sprint!)
    const rand = Math.random();
    let type = 'silver';
    let y = 35 + Math.random() * 20;
    let points = 150;

    if (rand < 0.3) {
      type = 'bronze';
      y = 12 + Math.random() * 14;
      points = 50;
    } else if (rand > 0.7) {
      type = 'gold';
      y = 75 + Math.random() * 30; // Requires serious pedaling cadence!
      points = 500;
    }

    const x = (Math.random() - 0.5) * 32;

    // Spawn Ring
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
      radius: 3.2,
      collected: false
    });

    // 2. Spawn Floating Gems / Crystals nearby
    const gemCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < gemCount; i++) {
      const gemMesh = new THREE.Mesh(this.gemGeo, this.gemMat);
      const gz = z + 6 + i * 4;
      const gx = x + (Math.random() - 0.5) * 6;
      const gy = y + (Math.random() - 0.5) * 4;
      gemMesh.position.set(gx, gy, gz);
      this.scene.add(gemMesh);

      this.gems.push({
        mesh: gemMesh,
        collected: false,
        points: 25
      });
    }

    // 3. Spawn Floating Clouds
    if (Math.random() < 0.6) {
      this.spawnCloud(
        (Math.random() - 0.5) * 140,
        y + (Math.random() - 0.5) * 30,
        z + (Math.random() - 0.5) * 20
      );
    }

    // 4. Spawn Floating Islands below
    if (Math.random() < 0.45) {
      this.spawnIsland(
        (Math.random() - 0.5) * 160,
        -10 + Math.random() * 15,
        z + (Math.random() - 0.5) * 30
      );
    }

    // 5. Occasionally spawn Thermal Updraft (rest & soar)
    if (Math.random() < 0.15) {
      this.spawnThermal(x + (Math.random() - 0.5) * 15, 5, z + 12);
    }
  }

  spawnCloud(x, y, z) {
    const cloudGroup = new THREE.Group();
    const puffGeo = new THREE.DodecahedronGeometry(6 + Math.random() * 6, 1);
    const puffMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88
    });

    const puffs = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < puffs; i++) {
      const p = new THREE.Mesh(puffGeo, puffMat);
      p.position.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 12
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

    // Rock Cone Base
    const rockGeo = new THREE.ConeGeometry(18 + Math.random() * 12, 35, 7);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.9,
      flatShading: true
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.rotation.x = Math.PI; // point downwards
    rock.position.y = -17;
    islandGroup.add(rock);

    // Green Grass Cap
    const grassGeo = new THREE.CylinderGeometry(18 + Math.random() * 12, 16, 3, 7);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.7,
      flatShading: true
    });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.position.y = 1;
    islandGroup.add(grass);

    // Low-poly stylized trees
    const treeCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < treeCount; i++) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.6, 3, 5),
        new THREE.MeshStandardMaterial({ color: 0x78350f })
      );
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(2.5, 5, 5),
        new THREE.MeshStandardMaterial({ color: 0x15803d, flatShading: true })
      );
      leaves.position.y = 3;

      const tree = new THREE.Group();
      tree.add(trunk);
      tree.add(leaves);
      tree.position.set(
        (Math.random() - 0.5) * 14,
        2.5,
        (Math.random() - 0.5) * 14
      );
      islandGroup.add(tree);
    }

    islandGroup.position.set(x, y, z);
    this.scene.add(islandGroup);
    this.islands.push(islandGroup);
  }

  spawnThermal(x, y, z) {
    const particleCount = 40;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 6;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 60;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.8,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    const thermal = new THREE.Points(geo, mat);
    thermal.position.set(x, y, z);
    this.scene.add(thermal);

    this.thermals.push({
      mesh: thermal,
      x,
      y,
      z,
      radius: 7
    });
  }

  /**
   * Update world objects, recycle passed elements, check player collisions
   */
  update(delta, playerPos, onCollectRing, onCollectGem, onEnterThermal) {
    // 1. Rotate rings and gems
    for (const r of this.rings) {
      if (!r.collected) {
        r.mesh.rotation.z += delta * 1.2;

        // Collision Check: Player distance to ring center
        const distZ = Math.abs(playerPos.z - r.z);
        if (distZ < 2.5) {
          const distX = playerPos.x - r.x;
          const distY = playerPos.y - r.y;
          const distXY = Math.sqrt(distX * distX + distY * distY);

          if (distXY <= r.radius + 0.8) {
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
        g.mesh.rotation.y += delta * 2.5;
        g.mesh.rotation.x += delta * 1.5;

        const dist = playerPos.distanceTo(g.mesh.position);
        if (dist < 3.0) {
          g.collected = true;
          this.scene.remove(g.mesh);
          if (onCollectGem) onCollectGem(g);
        }
      }
    }

    // 3. Thermals Updraft check
    for (const t of this.thermals) {
      // Animate particles rising
      const pos = t.mesh.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] += delta * 25;
        if (pos[i] > 60) pos[i] = 0;
      }
      t.mesh.geometry.attributes.position.needsUpdate = true;

      // Check if player is inside thermal cylinder
      const dx = playerPos.x - t.x;
      const dz = playerPos.z - t.z;
      const horizDist = Math.sqrt(dx * dx + dz * dz);
      if (horizDist < t.radius && playerPos.y >= t.y && playerPos.y <= t.y + 65) {
        if (onEnterThermal) onEnterThermal(delta);
      }
    }

    // 4. Recycle and spawn new segments ahead
    while (this.nextSpawnZ < playerPos.z + this.spawnDistanceZ) {
      this.spawnSegment(this.nextSpawnZ);
      this.nextSpawnZ += 28 + Math.random() * 12;
    }

    // Cleanup objects far behind the player
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

    this.thermals = this.thermals.filter((t) => {
      if (t.z < minZ) {
        this.scene.remove(t.mesh);
        return false;
      }
      return true;
    });
  }

  animateRingCollection(mesh) {
    // Quick burst scale & fade
    let progress = 0;
    const originalScale = mesh.scale.clone();

    const anim = () => {
      progress += 0.08;
      mesh.scale.set(
        originalScale.x * (1 + progress * 0.8),
        originalScale.y * (1 + progress * 0.8),
        originalScale.z * (1 + progress * 0.2)
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
