"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import * as THREE from "three";
import type { Vibe } from "@/data/vibes";
import VibePrompt from "./VibePrompt";

interface Props {
  vibes: Vibe[];
  onPreview: (vibe: Vibe) => void;
  onSelect: (vibe: Vibe) => void;
  onGenerated: (vibe: Vibe, prompt: string) => void;
}

type SceneItem = {
  group: THREE.Group;
  disc: THREE.Mesh;
  materials: THREE.Material[];
};

function patternToSteps(pattern?: string, fallback = "x---x---x---x---") {
  const source = (pattern || fallback).replace(/\s/g, "") || fallback;
  return Array.from({ length: 16 }, (_, step) => {
    const char = source[step % source.length] ?? "-";
    const active = !["-", ".", "_"].includes(char);
    const numeric = Number.parseInt(char, 16);
    const level = active ? (Number.isNaN(numeric) ? 0.72 : 0.38 + Math.min(numeric, 12) / 18) : 0.18;
    return { active, level };
  });
}

function shortestDelta(index: number, active: number, total: number) {
  let delta = index - active;
  if (delta > total / 2) delta -= total;
  if (delta < -total / 2) delta += total;
  return delta;
}

function normalizeIndex(index: number, total: number) {
  return ((index % total) + total) % total;
}

function formatPatternReadout(pattern?: Vibe["pattern"]) {
  if (!pattern) return "FREE";
  const scaleLabel = pattern.scale
    .replace("minorPentatonic", "min pent.")
    .replace("majorPentatonic", "maj pent.")
    .replace("harmonicMinor", "harm. minor")
    .replace("melodicMinor", "mel. minor")
    .replace("wholeTone", "whole tone");
  return `${pattern.root} ${scaleLabel}`;
}

function createCoverTexture(vibe: Vibe) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1280;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, vibe.palette.accent);
  gradient.addColorStop(0.48, "#171b24");
  gradient.addColorStop(1, vibe.palette.accent2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 18; i += 1) {
    ctx.beginPath();
    ctx.arc(740, 330, 90 + i * 28, 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.24)";
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "700 92px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(vibe.name, 92, 930);

  ctx.globalAlpha = 0.58;
  ctx.font = "500 38px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(vibe.subtitle.toUpperCase(), 96, 1005);

  ctx.globalAlpha = 0.18;
  ctx.font = "700 420px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(vibe.glyph, 76, 520);

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export default function VinylSceneSelector({ vibes, onPreview, onSelect, onGenerated }: Props) {
  const [index, setIndex] = useState(vibes.length - 1);
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const indexRef = useRef(index);
  const playheadRef = useRef(index);
  const pointerRef = useRef({ x: 0, y: 0 });
  const dragVelocityRef = useRef(0);
  const settleTweenRef = useRef<gsap.core.Tween | null>(null);
  const active = vibes[index];

  const toneStyle = useMemo(
    () => ({
      ["--scene-accent" as string]: active.palette.accent,
      ["--scene-accent-2" as string]: active.palette.accent2,
    }),
    [active],
  );
  const rhythmSteps = useMemo(
    () =>
      patternToSteps(
        active.pattern?.mini?.drums?.kick ??
          active.pattern?.mini?.bassline ??
          active.pattern?.mini?.melodyMotif,
      ),
    [active],
  );

  useEffect(() => {
    indexRef.current = index;
    onPreview(active);
  }, [active, index, onPreview]);

  const syncNearestIndex = useCallback((offset = playheadRef.current) => {
    const nextIndex = normalizeIndex(Math.round(offset), vibes.length);
    if (nextIndex !== indexRef.current) {
      indexRef.current = nextIndex;
      setIndex(nextIndex);
    }
  }, [vibes.length]);

  const animateToOffset = useCallback((offset: number, velocity = 0) => {
    settleTweenRef.current?.kill();
    const distance = Math.abs(offset - playheadRef.current);
    settleTweenRef.current = gsap.to(playheadRef, {
      current: offset,
      duration: Math.min(0.72, 0.34 + distance * 0.12 + Math.min(Math.abs(velocity) / 1800, 0.2)),
      ease: "power3.out",
      onUpdate: () => syncNearestIndex(),
      onComplete: () => syncNearestIndex(offset),
    });
  }, [syncNearestIndex]);

  function goToIndex(nextIndex: number) {
    const currentOffset = Math.round(playheadRef.current);
    const currentIndex = normalizeIndex(currentOffset, vibes.length);
    let delta = nextIndex - currentIndex;
    if (delta > vibes.length / 2) delta -= vibes.length;
    if (delta < -vibes.length / 2) delta += vibes.length;
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    animateToOffset(currentOffset + delta);
  }

  function move(delta: number) {
    const targetOffset = Math.round(playheadRef.current) + delta;
    const nextIndex = normalizeIndex(targetOffset, vibes.length);
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    animateToOffset(targetOffset);
  }

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.08, 6.2);

    const root = new THREE.Group();
    root.rotation.x = -0.04;
    scene.add(root);

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.8, 3.6, 4.2);
    scene.add(key);

    const rim = new THREE.PointLight(0x9dbbff, 2.2, 9);
    rim.position.set(-2.6, 1.7, 2.2);
    scene.add(rim);

    const sleeveGeometry = new THREE.BoxGeometry(1.42, 1.92, 0.08, 1, 1, 1);
    const discGeometry = new THREE.CylinderGeometry(0.73, 0.73, 0.045, 96);
    discGeometry.rotateX(Math.PI / 2);
    const labelGeometry = new THREE.CylinderGeometry(0.24, 0.24, 0.052, 72);
    labelGeometry.rotateX(Math.PI / 2);
    const grooveGeometry = new THREE.TorusGeometry(1, 0.004, 8, 128);
    const items: SceneItem[] = vibes.map((vibe) => {
      const group = new THREE.Group();

      const texture = createCoverTexture(vibe);
      const coverMaterial = new THREE.MeshPhysicalMaterial({
        map: texture,
        roughness: 0.54,
        metalness: 0.05,
        clearcoat: 0.5,
        clearcoatRoughness: 0.34,
      });
      const cover = new THREE.Mesh(sleeveGeometry, coverMaterial);
      cover.position.x = -0.24;
      group.add(cover);

      const discMaterial = new THREE.MeshPhysicalMaterial({
        color: "#08090d",
        roughness: 0.38,
        metalness: 0.18,
        clearcoat: 0.9,
        clearcoatRoughness: 0.2,
      });
      const disc = new THREE.Mesh(discGeometry, discMaterial);
      disc.position.set(0.5, 0, -0.075);
      group.add(disc);

      const labelMaterial = new THREE.MeshStandardMaterial({
        color: vibe.palette.accent,
        roughness: 0.42,
        metalness: 0.05,
      });
      const label = new THREE.Mesh(labelGeometry, labelMaterial);
      label.position.set(0.5, 0, -0.045);
      group.add(label);

      const grooveMaterial = new THREE.MeshBasicMaterial({
        color: "#2d3340",
        transparent: true,
        opacity: 0.28,
      });
      for (let i = 0; i < 5; i += 1) {
        const groove = new THREE.Mesh(grooveGeometry, grooveMaterial);
        groove.scale.setScalar(0.28 + i * 0.09);
        groove.position.set(0.5, 0, -0.042);
        group.add(groove);
      }

      root.add(group);
      return { group, disc, materials: [coverMaterial, discMaterial, labelMaterial, grooveMaterial] };
    });

    const timer = new THREE.Timer();
    timer.connect(document);
    let width = 0;
    let height = 0;
    let raf = 0;

    function resize() {
      const rect = canvasEl!.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function animate() {
      timer.update();
      const elapsed = timer.getElapsed();
      const activeIndex = playheadRef.current;
      root.rotation.y += (pointerRef.current.x * 0.16 - root.rotation.y) * 0.045;
      root.rotation.x += (-0.04 + pointerRef.current.y * 0.055 - root.rotation.x) * 0.045;

      items.forEach((item, itemIndex) => {
        const delta = shortestDelta(itemIndex, activeIndex, vibes.length);
        const distance = Math.abs(delta);
        item.group.visible = distance <= 2;

        const targetX = delta * 1.18;
        const targetY =
          -distance * 0.06 + (reduceMotion ? 0 : Math.sin(elapsed * 1.1 + itemIndex) * 0.018);
        const targetZ = -distance * 0.52;
        const targetScale = delta === 0 ? 1.18 : 0.78;
        const targetRotY = -delta * 0.46;
        const targetRotZ = delta * 0.03;

        item.group.position.x += (targetX - item.group.position.x) * 0.085;
        item.group.position.y += (targetY - item.group.position.y) * 0.085;
        item.group.position.z += (targetZ - item.group.position.z) * 0.085;
        item.group.scale.x += (targetScale - item.group.scale.x) * 0.085;
        item.group.scale.y += (targetScale - item.group.scale.y) * 0.085;
        item.group.scale.z += (targetScale - item.group.scale.z) * 0.085;
        item.group.rotation.y += (targetRotY - item.group.rotation.y) * 0.085;
        item.group.rotation.z += (targetRotZ - item.group.rotation.z) * 0.085;

        if (!reduceMotion) {
          item.disc.rotation.z +=
            (delta === 0 ? 0.018 : 0.006) + (delta === 0 ? dragVelocityRef.current * 0.012 : 0);
        }
      });
      dragVelocityRef.current *= 0.92;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      timer.disconnect();
      timer.dispose();
      items.forEach((item) => {
        item.materials.forEach((material) => {
          if ("map" in material && material.map instanceof THREE.Texture) {
            material.map.dispose();
          }
          material.dispose();
        });
      });
      sleeveGeometry.dispose();
      discGeometry.dispose();
      labelGeometry.dispose();
      grooveGeometry.dispose();
      renderer.dispose();
    };
  }, [vibes]);

  useEffect(() => {
    const root = rootRef.current;
    const canvasEl = canvasRef.current;
    if (!root || !canvasEl) return;

    gsap.registerPlugin(Draggable);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const proxy = document.createElement("div");
    const clampVelocity = gsap.utils.clamp(-2.8, 2.8);
    let startOffset = playheadRef.current;
    let lastX = 0;
    let lastTime = 0;
    let releaseVelocity = 0;

    const entrance = reduceMotion
      ? null
      : gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .fromTo(
            root.querySelectorAll(".vinyl-selector__head, .vinyl-scene-shell, .vinyl-meta, .blank-record-slot, .vinyl-queue"),
            { y: 18, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.72, stagger: 0.07 },
          );

    const draggables = Draggable.create(proxy, {
      type: "x",
      trigger: canvasEl,
      minimumMovement: 3,
      onPress() {
        settleTweenRef.current?.kill();
        startOffset = playheadRef.current;
        lastX = this.x;
        lastTime = performance.now();
        releaseVelocity = 0;
        gsap.set(root, { "--drag-energy": 1 });
        root.classList.add("is-dragging");
      },
      onDrag() {
        const rect = canvasEl.getBoundingClientRect();
        const step = Math.max(150, rect.width * 0.22);
        const now = performance.now();
        const elapsed = Math.max(8, now - lastTime);
        releaseVelocity = ((this.x - lastX) / elapsed) * 1000;
        lastX = this.x;
        lastTime = now;
        playheadRef.current = startOffset + (this.startX - this.x) / step;
        dragVelocityRef.current = clampVelocity(-releaseVelocity / 850);
        syncNearestIndex();
      },
      onRelease() {
        const velocity = releaseVelocity;
        const momentum = gsap.utils.clamp(-0.42, 0.42, -velocity / 2200);
        const targetOffset = Math.round(playheadRef.current + momentum);
        const nextIndex = normalizeIndex(targetOffset, vibes.length);
        indexRef.current = nextIndex;
        setIndex(nextIndex);
        animateToOffset(targetOffset, velocity);
        gsap.to(root, { "--drag-energy": 0, duration: 0.42, ease: "power2.out" });
        root.classList.remove("is-dragging");
      },
    });

    return () => {
      entrance?.kill();
      draggables.forEach((draggable) => draggable.kill());
      settleTweenRef.current?.kill();
    };
  }, [animateToOffset, syncNearestIndex, vibes.length]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = root.querySelectorAll(".vinyl-meta__glyph, .vinyl-meta__copy, .vinyl-meta__play, .vinyl-rhythm span");
    gsap.fromTo(
      targets,
      { y: 8, autoAlpha: 0.72 },
      { y: 0, autoAlpha: 1, duration: 0.42, stagger: 0.012, ease: "power2.out", overwrite: true },
    );
  }, [active.id]);

  return (
    <section ref={rootRef} className="vinyl-selector" style={toneStyle} aria-label="选择氛围唱片">
      <div className="vinyl-selector__head">
        <div>
          <span className="vinyl-selector__kicker mono">LIVE CRATE</span>
          <h2>选择唱片</h2>
            <p>拖动封套，或刻一张新的。</p>
        </div>
        <div className="vinyl-orbit-readout mono" aria-hidden="true">
          <span>{formatPatternReadout(active.pattern)}</span>
          <span>{Math.round(active.params.tempo)} BPM</span>
          <span>{String(index + 1).padStart(2, "0")}/{String(vibes.length).padStart(2, "0")}</span>
        </div>
        <div className="vinyl-selector__controls" aria-label="切换唱片">
          <button type="button" onClick={() => move(-1)} aria-label="上一张唱片">
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" onClick={() => move(1)} aria-label="下一张唱片">
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      <div className="vinyl-scene-shell">
        <div className="vinyl-scene-shell__dial" aria-hidden="true" />
        <div className="vinyl-scene-shell__needle" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className="vinyl-scene"
          aria-hidden="true"
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            pointerRef.current.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
            pointerRef.current.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
          }}
          onPointerLeave={() => {
            pointerRef.current = { x: 0, y: 0 };
          }}
        />
      </div>

      <div className="vinyl-meta">
        <span className="vinyl-meta__glyph" aria-hidden="true">
          {active.glyph}
        </span>
        <div className="vinyl-meta__copy">
          <h3>{active.name}</h3>
          <p>{active.tagline}</p>
          <div className="vinyl-rhythm" aria-hidden="true">
            {rhythmSteps.map((step, stepIndex) => (
              <span
                key={`${active.id}-rhythm-${stepIndex}`}
                className={step.active ? "is-on" : ""}
                style={{ ["--step-level" as string]: step.level }}
              />
            ))}
          </div>
        </div>
        <button type="button" className="vinyl-meta__play" onClick={() => onSelect(active)}>
          播放
        </button>
      </div>

      <VibePrompt
        onGenerated={onGenerated}
        accent={active.palette.accent}
        accent2={active.palette.accent2}
      />

      <div
        className="vinyl-queue"
        role="listbox"
        aria-label="唱片队列"
        aria-activedescendant={`vibe-disc-${active.id}`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") move(-1);
          if (event.key === "ArrowRight") move(1);
          if (event.key === "Enter") onSelect(active);
        }}
      >
        {vibes.map((vibe, vibeIndex) => (
          <button
            id={`vibe-disc-${vibe.id}`}
            type="button"
            role="option"
            aria-selected={vibeIndex === index}
            key={vibe.id}
            className={`vinyl-chip ${vibeIndex === index ? "vinyl-chip--active" : ""}`}
            style={{ ["--chip-accent" as string]: vibe.palette.accent }}
            onClick={() => goToIndex(vibeIndex)}
          >
            <span aria-hidden="true" />
            <span>{vibe.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
