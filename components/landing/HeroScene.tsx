"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

/* ================================================================
   Procedural cricket-ball textures — ported from Cricket Ball 3D.html
   All maps generated on canvas, no external assets.
   ================================================================ */

const TEX_W = 1024, TEX_H = 512;
const SEAM_Y = TEX_H / 2;
const STITCH_ROWS = [-54, -36, -18, 18, 36, 54];
const STITCH_SPACING = 23;
const STITCH_LEN = 15;

const LEATHER = {
  grad: ["#7e0d14", "#a3151e", "#b01a22"],
  mottleLight: "rgba(214,60,52,A)",  mottleDark: "rgba(96,8,14,A)",
  hotLight: "rgba(255,150,120,A)",   hotDark: "rgba(60,4,10,A)",
  wearPatch: "rgba(170,95,70,A)",
  scuffDark: "rgba(70,6,10,",        scuffLight: "rgba(230,120,100,",
  bandDark: "rgba(40,3,6,",
  groove: "rgba(30,2,4,0.85)",       edgeLight: "rgba(255,160,130,0.16)",
  qDark: "rgba(58,4,8,0.45)",        qLight: "rgba(255,170,140,0.10)",
  thread: [222, 206, 158] as [number, number, number],
  stitchShadow: "rgba(25,2,4,0.55)",
};

function makeOffscreen(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function addGrain(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * strength;
    d[i]     = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.7));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.7));
  }
  ctx.putImageData(img, 0, 0);
}

function addMottle(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  count: number, baseAlpha: number, light: string, dark: string
) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 30 + Math.random() * 160;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = Math.random() > 0.5 ? light : dark;
    g.addColorStop(0, col.replace("A", (baseAlpha * (0.4 + Math.random() * 0.6)).toFixed(3)));
    g.addColorStop(1, col.replace("A", "0"));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function drawStitchRow(
  ctx: CanvasRenderingContext2D, y: number, angleDeg: number,
  colorFn: () => string, lineWidth: number
) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a) * STITCH_LEN / 2;
  const dy = Math.sin(a) * STITCH_LEN / 2;
  ctx.lineCap = "round";
  for (let x = -STITCH_SPACING; x < TEX_W + STITCH_SPACING; x += STITCH_SPACING) {
    const jx = x + (Math.random() - 0.5) * 3;
    const jy = y + (Math.random() - 0.5) * 2.5;
    ctx.strokeStyle = colorFn();
    ctx.lineWidth = lineWidth + (Math.random() - 0.5) * 0.8;
    ctx.beginPath();
    ctx.moveTo(jx - dx, jy - dy);
    ctx.lineTo(jx + dx, jy + dy);
    ctx.stroke();
  }
}

function drawQuarterSeam(
  ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number,
  color: string, width: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
}

function buildColorMap(ctx: CanvasRenderingContext2D) {
  const p = LEATHER;
  const grad = ctx.createLinearGradient(0, 0, 0, TEX_H);
  grad.addColorStop(0.0, p.grad[0]);
  grad.addColorStop(0.32, p.grad[1]);
  grad.addColorStop(0.5, p.grad[2]);
  grad.addColorStop(0.68, p.grad[1]);
  grad.addColorStop(1.0, p.grad[0]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  addMottle(ctx, TEX_W, TEX_H, 60, 0.10, p.mottleLight, p.mottleDark);
  addMottle(ctx, TEX_W, TEX_H, 20, 0.06, p.hotLight, p.hotDark);

  for (let i = 0; i < 300; i++) {
    const x = Math.random() * TEX_W;
    const y = Math.random() * TEX_H;
    ctx.fillStyle = Math.random() > 0.5
      ? p.scuffDark + (Math.random() * 0.18).toFixed(3) + ")"
      : p.scuffLight + (Math.random() * 0.10).toFixed(3) + ")";
    ctx.fillRect(x, y, 1 + Math.random() * 2.5, 1 + Math.random() * 1.5);
  }

  addGrain(ctx, TEX_W, TEX_H, 22);

  const bandTop = SEAM_Y - 66, bandBot = SEAM_Y + 66;
  [TEX_W * 0.25, TEX_W * 0.75].forEach((qx, hemi) => {
    const y0 = hemi === 0 ? 0 : bandBot;
    const y1 = hemi === 0 ? bandTop : TEX_H;
    drawQuarterSeam(ctx, qx - 1.5, y0, y1, p.qDark, 3);
    drawQuarterSeam(ctx, qx + 2.5, y0, y1, p.qLight, 2);
    const qx2 = (qx + TEX_W / 2) % TEX_W;
    drawQuarterSeam(ctx, qx2 - 1.5, y0, y1, p.qDark, 3);
    drawQuarterSeam(ctx, qx2 + 2.5, y0, y1, p.qLight, 2);
  });

  const band = ctx.createLinearGradient(0, SEAM_Y - 70, 0, SEAM_Y + 70);
  band.addColorStop(0, p.bandDark + "0)");
  band.addColorStop(0.25, p.bandDark + "0.22)");
  band.addColorStop(0.5, p.bandDark + "0.38)");
  band.addColorStop(0.75, p.bandDark + "0.22)");
  band.addColorStop(1, p.bandDark + "0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, SEAM_Y - 70, TEX_W, 140);

  ctx.fillStyle = p.groove;
  ctx.fillRect(0, SEAM_Y - 2.5, TEX_W, 5);
  ctx.fillStyle = p.edgeLight;
  ctx.fillRect(0, SEAM_Y - 7, TEX_W, 2.5);
  ctx.fillRect(0, SEAM_Y + 4.5, TEX_W, 2.5);

  STITCH_ROWS.forEach((dy, i) => {
    const angle = i % 2 === 0 ? 38 : -38;
    drawStitchRow(ctx, SEAM_Y + dy + 2, angle, () => p.stitchShadow, 5.5);
    drawStitchRow(ctx, SEAM_Y + dy, angle, () => {
      const j = Math.floor((Math.random() - 0.5) * 26);
      return `rgb(${p.thread[0] + j},${p.thread[1] + j},${p.thread[2] + j})`;
    }, 4.5);
  });
}

function buildBumpMap(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  addGrain(ctx, TEX_W, TEX_H, 26);

  const band = ctx.createLinearGradient(0, SEAM_Y - 70, 0, SEAM_Y + 70);
  band.addColorStop(0, "rgba(255,255,255,0)");
  band.addColorStop(0.5, "rgba(255,255,255,0.30)");
  band.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, SEAM_Y - 70, TEX_W, 140);

  ctx.fillStyle = "rgba(0,0,0,0.9)";
  ctx.fillRect(0, SEAM_Y - 3, TEX_W, 6);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(0, SEAM_Y - 9, TEX_W, 4);
  ctx.fillRect(0, SEAM_Y + 5, TEX_W, 4);

  STITCH_ROWS.forEach((dy, i) => {
    const angle = i % 2 === 0 ? 38 : -38;
    drawStitchRow(ctx, SEAM_Y + dy, angle, () => "rgba(255,255,255,0.95)", 4.5);
  });

  const bandTop = SEAM_Y - 66, bandBot = SEAM_Y + 66;
  [TEX_W * 0.25, TEX_W * 0.75].forEach((qx, hemi) => {
    const y0 = hemi === 0 ? 0 : bandBot;
    const y1 = hemi === 0 ? bandTop : TEX_H;
    drawQuarterSeam(ctx, qx, y0, y1, "rgba(0,0,0,0.4)", 3);
    drawQuarterSeam(ctx, (qx + TEX_W / 2) % TEX_W, y0, y1, "rgba(0,0,0,0.4)", 3);
  });
}

function buildRoughnessMap(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#6a6a6a";
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  addMottle(ctx, TEX_W, TEX_H, 35, 0.18, "rgba(180,180,180,A)", "rgba(70,70,70,A)");
  addGrain(ctx, TEX_W, TEX_H, 30);

  ctx.fillStyle = "rgba(190,190,190,0.45)";
  ctx.fillRect(0, SEAM_Y - 66, TEX_W, 132);
  STITCH_ROWS.forEach((dy, i) => {
    const angle = i % 2 === 0 ? 38 : -38;
    drawStitchRow(ctx, SEAM_Y + dy, angle, () => "rgba(225,225,225,0.95)", 4.5);
  });
}

function buildEnvCanvas(): HTMLCanvasElement {
  const c = makeOffscreen(512, 256);
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#1c1e26");
  g.addColorStop(0.55, "#0a0b10");
  g.addColorStop(1, "#03030a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  const softbox = (x: number, y: number, w: number, h: number, color: string, alpha: string) => {
    const r = ctx.createRadialGradient(x, y, 4, x, y, Math.max(w, h));
    r.addColorStop(0, color.replace("A", alpha));
    r.addColorStop(1, color.replace("A", "0"));
    ctx.fillStyle = r;
    ctx.fillRect(x - w, y - h, w * 2, h * 2);
  };
  softbox(140, 60, 130, 70, "rgba(255,238,214,A)", "0.95");
  softbox(400, 95, 90, 55, "rgba(186,205,255,A)", "0.5");
  softbox(270, 230, 200, 40, "rgba(120,40,40,A)", "0.25");
  return c;
}

export default function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const isMobile = window.innerWidth < 768;

    /* ---------- Renderer ---------- */
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    (renderer as any).outputColorSpace = "srgb";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    container.appendChild(renderer.domElement);

    /* ---------- Scene & camera ---------- */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.15, 9);

    /* ---------- Environment map ---------- */
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envTex = new THREE.CanvasTexture(buildEnvCanvas());
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    const envRT = pmrem.fromEquirectangular(envTex);
    envTex.dispose();

    /* ---------- Build textures ---------- */
    const colorCanvas = makeOffscreen(TEX_W, TEX_H);
    const bumpCanvas  = makeOffscreen(TEX_W, TEX_H);
    const roughCanvas = makeOffscreen(TEX_W, TEX_H);
    buildColorMap(colorCanvas.getContext("2d")!);
    buildBumpMap(bumpCanvas.getContext("2d")!);
    buildRoughnessMap(roughCanvas.getContext("2d")!);

    const colorMap = new THREE.CanvasTexture(colorCanvas);
    (colorMap as any).colorSpace = "srgb";
    colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const bumpMap  = new THREE.CanvasTexture(bumpCanvas);
    const roughMap = new THREE.CanvasTexture(roughCanvas);

    /* ---------- Ball material & mesh ---------- */
    const material = new THREE.MeshPhysicalMaterial({
      map: colorMap,
      bumpMap,
      bumpScale: 0.016,
      roughnessMap: roughMap,
      roughness: 1.0,
      metalness: 0.0,
      clearcoat: 0.75,
      clearcoatRoughness: 0.28,
      envMap: envRT.texture,
      envMapIntensity: 0.9,
    });

    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.4, 96, 96), material);
    const pivot = new THREE.Group();
    pivot.rotation.z = -0.42;
    pivot.rotation.x = 0.28;
    pivot.add(ball);

    const root = new THREE.Group();
    root.add(pivot);
    scene.add(root);

    /* ---------- Lights ---------- */
    scene.add(new THREE.AmbientLight(0x402028, 0.55));
    const key = new THREE.DirectionalLight(0xffe9d2, 1.5);
    key.position.set(2.6, 3.2, 2.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xa9c2ff, 0.32);
    fill.position.set(-3.2, 0.6, 1.8);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xdde6ff, 0.9);
    rim.position.set(-1.6, 1.4, -3.2);
    scene.add(rim);

    /* ---------- Particle field ---------- */
    const totalParticles = isMobile ? 1500 : 3000;
    const greenCount = Math.round(totalParticles / 6);
    const starCount = totalParticles - greenCount;

    const randomInSphere = (r: number) => {
      const v = new THREE.Vector3();
      do { v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1); }
      while (v.lengthSq() > 1);
      return v.multiplyScalar(r);
    };

    const makeParticles = (count: number, color: number, size: number) => {
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const c = new THREE.Color(color);
      for (let i = 0; i < count; i++) {
        const p = randomInSphere(25);
        positions.set([p.x, p.y, p.z], i * 3);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      return new THREE.Points(geo, new THREE.PointsMaterial({
        size, vertexColors: true, transparent: true, opacity: 0.9,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
    };

    const stars    = makeParticles(starCount, 0xffffff, 0.03);
    const fieldDust = makeParticles(greenCount, 0x22c55e, 0.06);
    scene.add(stars, fieldDust);

    /* ---------- Ground rings ---------- */
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.5,
      transparent: true, opacity: 0.9,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.05, 8, 100), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -2.5;
    scene.add(ring);

    const outerRingMat = ringMat.clone();
    outerRingMat.opacity = 0.3;
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(6, 0.05, 8, 100), outerRingMat);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = -2.5;
    scene.add(outerRing);

    /* ---------- Camera intro ---------- */
    gsap.to(camera.position, { z: 5.5, duration: 0.6, ease: "power2.out" });

    const mouse = { x: 0, y: 0 };
    let velX = 0, velY = 0, idleTimer = 0, dragging = false, lastX = 0, lastY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      velX = 0; velY = 0;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      velY = (e.clientX - lastX) * 0.005;
      velX = (e.clientY - lastY) * 0.003;
      lastX = e.clientX; lastY = e.clientY;
      root.rotation.y += velY;
      root.rotation.x = Math.max(-0.9, Math.min(0.9, root.rotation.x + velX));
      idleTimer = 0;
    };
    const onPointerUp = () => { dragging = false; };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.style.cursor = "grab";
    window.addEventListener("mousemove", onMouseMove);

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    /* ---------- Render loop ---------- */
    const clock = new THREE.Clock();
    let raf = 0;
    const spinSpeed = 0.25;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t  = clock.getElapsedTime();

      if (!dragging) {
        root.rotation.y += velY;
        root.rotation.x = Math.max(-0.9, Math.min(0.9, root.rotation.x + velX));
        velY *= 0.95; velX *= 0.92;
        idleTimer += dt;
        if (idleTimer > 1.2) {
          ball.rotation.y += dt * spinSpeed;
          root.rotation.x += (0 - root.rotation.x) * dt * 0.6;
        }
      }

      // Drift particles upward
      const pos = fieldDust.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + 0.002;
        if (y > 25) y = -25;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;

      // Float
      root.position.y = Math.sin(t * 0.9) * 0.08;

      // Rings
      ring.rotation.z += 0.0015;
      outerRing.rotation.z -= 0.001;

      // Camera parallax
      camera.position.x += (mouse.x * 0.4 - camera.position.x) * 0.04;
      camera.position.y += (-mouse.y * 0.25 + Math.sin(t * 0.3) * 0.08 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      gsap.killTweensOf(camera.position);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          Array.isArray(m) ? m.forEach((x) => x.dispose()) : m.dispose();
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />;
}
