// Hyperspace-jump starfield for the loading overlay. three.js is imported
// dynamically so it code-splits into its own chunk and only ever loads the
// first time a jump starts.

export interface Hyperspace {
  /** Ramp the starfield up to jump speed. */
  engage(): void;
  /** Ramp back down; resolves once the streaks have settled. */
  disengage(): Promise<void>;
  dispose(): void;
}

const STAR_COUNT = 700;
const FIELD_DEPTH = 400;
const JUMP_SPEED = 14;

export async function createHyperspace(canvas: HTMLCanvasElement): Promise<Hyperspace> {
  const THREE = await import('three');

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, FIELD_DEPTH * 1.5);

  // Each star is a line segment whose length scales with speed: a dot while
  // drifting, a streak at jump speed. Stars live on a cylindrical shell around
  // the camera axis so they fly past the lens, never into it.
  const stars: { x: number; y: number; z: number }[] = [];
  const colors = new Float32Array(STAR_COUNT * 6);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 6 + Math.random() * 60;
    const a = Math.random() * Math.PI * 2;
    stars.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: -Math.random() * FIELD_DEPTH });
    // Blue-white tint; bright head fading to a dim blue tail.
    const tint = 0.75 + Math.random() * 0.25;
    colors.set([tint, tint, 1, tint * 0.1, tint * 0.1, 0.2], i * 6);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STAR_COUNT * 6), 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
  scene.add(new THREE.LineSegments(geom, mat));

  let speed = 0;
  let targetSpeed = 0;
  let raf = 0;
  let settled: (() => void) | null = null;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    resize();
    speed += (targetSpeed - speed) * 0.055;
    const len = speed * 5;
    const pos = geom.getAttribute('position') as InstanceType<typeof THREE.BufferAttribute>;
    for (let i = 0; i < STAR_COUNT; i++) {
      const s = stars[i];
      s.z += speed;
      if (s.z > 10) s.z -= FIELD_DEPTH;
      pos.setXYZ(i * 2, s.x, s.y, s.z + len);
      pos.setXYZ(i * 2 + 1, s.x, s.y, s.z);
    }
    pos.needsUpdate = true;
    renderer.render(scene, camera);
    if (settled && speed < 0.4) {
      settled();
      settled = null;
    }
  }
  frame();

  return {
    engage() {
      targetSpeed = JUMP_SPEED;
    },
    disengage() {
      targetSpeed = 0;
      return new Promise((resolve) => {
        settled = resolve;
      });
    },
    dispose() {
      cancelAnimationFrame(raf);
      geom.dispose();
      mat.dispose();
      renderer.dispose();
    },
  };
}
