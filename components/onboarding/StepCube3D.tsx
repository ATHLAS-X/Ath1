"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

/** 50×50 rotating cube badge — faces show step numbers, rotates to the right face on step change. */
export default function StepCube3D({ step }: { step: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    camera.position.z = 4;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(50, 50);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    // 6 face textures: numbers step..step+5 (wraps), current face is +X
    const makeFace = (n: number) => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#050D18";
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = "#22C55E";
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 116, 116);
      ctx.fillStyle = "#22C55E";
      ctx.font = "bold 64px Inter, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(n), 64, 68);
      return new THREE.CanvasTexture(c);
    };

    // face order in BoxGeometry: +x, -x, +y, -y, +z, -z. Put `step` on +z (facing camera).
    const nums = [step + 1, step - 1, step + 2, step - 2, step, step + 3].map(
      (n) => ((n - 1 + 12) % 12) + 1
    );
    const mats = nums.map(
      (n) =>
        new THREE.MeshStandardMaterial({
          map: makeFace(n),
          emissive: 0x22c55e,
          emissiveIntensity: 0.15,
        })
    );
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), mats);
    cubeRef.current = cube;
    scene.add(cube);
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    // entrance spin to front face
    cube.rotation.set(0.6, 1.2, 0);
    gsap.to(cube.rotation, { x: 0.25, y: -0.35, z: 0, duration: 0.9, ease: "power3.out" });

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      gsap.killTweensOf(cube.rotation);
      cube.geometry.dispose();
      mats.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [step]);

  return <div ref={ref} style={{ width: 50, height: 50 }} aria-hidden="true" />;
}
