"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Subtle top-down 3D cricket field behind onboarding steps.
 * Fixed full-viewport, z-index -1, opacity ~0.08 elements.
 */
export default function CricketFieldBg() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const scene = new THREE.Scene();
    const aspect = w / h;
    const view = 10;
    const camera = new THREE.OrthographicCamera(-view * aspect, view * aspect, view, -view, 0.1, 50);
    camera.position.set(0, 20, 0);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const flat = (color: number, opacity = 0.08) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });

    const field = new THREE.Group();

    const boundary = new THREE.Mesh(new THREE.CircleGeometry(8, 64), flat(0x14532d));
    boundary.rotation.x = -Math.PI / 2;
    field.add(boundary);

    const inner = new THREE.Mesh(new THREE.CircleGeometry(1.5, 64), flat(0x16a34a));
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.01;
    field.add(inner);

    const pitch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 3), flat(0xc2a368));
    pitch.position.y = 0.02;
    field.add(pitch);

    // crease lines
    for (const z of [-1.2, 1.2]) {
      const crease = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.03), flat(0xffffff, 0.1));
      crease.position.set(0, 0.03, z);
      field.add(crease);
    }

    scene.add(field);

    const onResize = () => {
      const nw = window.innerWidth;
      const nh = window.innerHeight;
      const a = nw / nh;
      camera.left = -view * a;
      camera.right = view * a;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      field.rotation.y += 0.0003;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
    />
  );
}
