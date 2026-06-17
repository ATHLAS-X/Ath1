"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

interface Props {
  step: number;
  size?: number;
}

/** Builds the step-specific mesh group. Returns null for steps with no icon. */
function buildIcon(step: number): THREE.Group | null {
  const g = new THREE.Group();
  const green = (extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 0.5,
      metalness: 0.3,
      roughness: 0.4,
      ...extra,
    });

  switch (step) {
    case 2: {
      // Shield: torus + checkmark plane
      g.add(new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.12, 16, 48), green()));
      const check = new THREE.Shape();
      check.moveTo(-0.35, 0);
      check.lineTo(-0.1, -0.25);
      check.lineTo(0.4, 0.3);
      check.lineTo(0.3, 0.4);
      check.lineTo(-0.1, -0.02);
      check.lineTo(-0.25, 0.12);
      check.closePath();
      const mark = new THREE.Mesh(new THREE.ShapeGeometry(check), green({ side: THREE.DoubleSide }));
      g.add(mark);
      return g;
    }
    case 4: {
      // Cricket bat: extruded blade + cylinder handle
      const blade = new THREE.Shape();
      blade.moveTo(-0.18, -0.7);
      blade.lineTo(0.18, -0.7);
      blade.lineTo(0.18, 0.4);
      blade.quadraticCurveTo(0.18, 0.55, 0, 0.55);
      blade.quadraticCurveTo(-0.18, 0.55, -0.18, 0.4);
      blade.closePath();
      const bladeMesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(blade, { depth: 0.12, bevelEnabled: false }),
        green()
      );
      g.add(bladeMesh);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 16), green({ emissiveIntensity: 0.3 }));
      handle.position.y = -1;
      g.add(handle);
      g.rotation.z = 0.4;
      g.scale.setScalar(0.9);
      return g;
    }
    case 5: {
      // Bar chart prisms
      const heights = [0.4, 0.8, 0.6, 1.1, 0.9];
      heights.forEach((h, i) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, 0.22), green({ emissiveIntensity: 0.35 }));
        bar.position.set((i - 2) * 0.32, h / 2 - 0.5, 0);
        bar.scale.y = 0.01;
        g.add(bar);
        gsap.to(bar.scale, { y: 1, duration: 1, delay: 0.1 * i, ease: "power3.out" });
      });
      return g;
    }
    case 7: {
      // Pulsing heart (sphere, sine scale handled in loop via userData)
      const heart = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 32), green({ color: 0xf43f5e, emissive: 0xf43f5e }));
      heart.userData.pulse = true;
      g.add(heart);
      return g;
    }
    case 8: {
      // Brain wireframe
      g.add(
        new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.85, 1),
          new THREE.MeshBasicMaterial({ color: 0xa78bfa, wireframe: true, transparent: true, opacity: 0.9 })
        )
      );
      return g;
    }
    case 9: {
      // Play button prism (triangular cylinder)
      const play = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 3), green());
      play.rotation.x = Math.PI / 2;
      play.rotation.z = Math.PI / 2;
      g.add(play);
      return g;
    }
    case 11: {
      // Score ring
      g.add(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.16, 24, 80), green()));
      return g;
    }
    case 12: {
      // Globe with green latitude lines
      g.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 24, 12),
          new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true, transparent: true, opacity: 0.7 })
        )
      );
      return g;
    }
    default:
      return null;
  }
}

export default function StepIcon3D({ step, size = 80 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const icon = buildIcon(step);
    if (!icon) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
    camera.position.z = 3.4;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    scene.add(icon);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.PointLight(0xffffff, 8, 12);
    light.position.set(2, 2, 3);
    scene.add(light);

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      icon.rotation.y += 0.012;
      icon.traverse((o) => {
        if (o.userData.pulse) {
          const s = 1 + Math.sin(t * 4) * 0.12;
          o.scale.setScalar(s);
        }
      });
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [step, size]);

  if (![2, 4, 5, 7, 8, 9, 11, 12].includes(step)) return null;
  return <div ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}
