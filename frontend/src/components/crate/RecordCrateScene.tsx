"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type CrateCover = { id: string; title: string; image: string; backImage?: string };
export type CrateMove = { serial: number; delta: 1 | -1 } | null;

export default function RecordCrateScene({ covers, index, move, brand, zoom = 100, showBack = false, onSettled, onSwipe }: {
  covers: CrateCover[]; index: number; move: CrateMove; brand: string;
  zoom?: number; showBack?: boolean;
  onSettled: (delta: 1 | -1) => void; onSwipe: (delta: 1 | -1) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef({ index, move, zoom, showBack, onSettled, onSwipe });
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { current.current = { index, move, zoom, showBack, onSettled, onSwipe }; }, [index, move, zoom, showBack, onSettled, onSwipe]);
  useEffect(() => {
    if (!unavailable || !move) return;
    const timer = setTimeout(() => onSettled(move.delta), 100);
    return () => clearTimeout(timer);
  }, [unavailable, move, onSettled]);

  useEffect(() => {
    const element = host.current;
    if (!element || !covers.length) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true }); }
    catch { setUnavailable(true); return; }
    setUnavailable(false);
    let disposed = false, dirty = true, frame = 0, builtIndex = -1, builtDirection = 0;
    let started = 0, serial = -1, completed = -1;
    let rotation = 0, magnification = 1, previousTime = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f3f6f7');
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label', 'Cajón de discos en 3D');
    renderer.domElement.setAttribute('role', 'img');
    element.appendChild(renderer.domElement);
    const contextLost = (event: Event) => { event.preventDefault(); visible = false; if (!disposed) setUnavailable(true); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x778687, 1.8));
    const light = new THREE.DirectionalLight(0xffffff, 2.4);
    light.position.set(-3, 7, 5);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -5; light.shadow.camera.right = 5;
    light.shadow.camera.top = 6; light.shadow.camera.bottom = -4;
    light.shadow.normalBias = 0.03;
    scene.add(light);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: 0.12 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const wood = new THREE.MeshStandardMaterial({ color: '#b88956', roughness: 0.94 });
    const darkWood = new THREE.MeshStandardMaterial({ color: '#805c37', roughness: 1 });
    const crate = new THREE.Group();
    const plank = (w: number, h: number, d: number, x: number, y: number, z: number, material = wood) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; crate.add(mesh);
    };
    plank(2.88, 0.1, 2.55, 0, 0.09, -0.03, darkWood);
    for (const y of [0.23, 0.45, 0.67]) {
      plank(2.88, 0.19, 0.1, 0, y, 1.18);
      plank(2.88, 0.19, 0.1, 0, y, -1.25);
      plank(0.1, 0.19, 2.5, -1.39, y, -0.03);
      plank(0.1, 0.19, 2.5, 1.39, y, -0.03);
    }
    for (const x of [-1.27, 1.27]) {
      plank(0.12, 0.75, 0.1, x, 0.43, 1.245, darkWood);
      plank(0.12, 0.75, 0.1, x, 0.43, -1.32, darkWood);
    }
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 1024; labelCanvas.height = 128;
    const labelContext = labelCanvas.getContext('2d')!;
    labelContext.fillStyle = '#2f251b'; labelContext.font = 'bold 64px Arial';
    labelContext.textAlign = 'center'; labelContext.textBaseline = 'middle';
    labelContext.fillText(brand.toUpperCase().slice(0, 28), 512, 64, 920);
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.24), new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true }));
    label.position.set(0, 0.46, 1.237);
    crate.add(label);
    scene.add(crate);

    const jackets = new THREE.Group(); scene.add(jackets);
    crate.position.y = 0.24;
    jackets.position.y = 0.24;
    floor.position.y = 0.24;
    const textures = new Map<string, THREE.Texture>();
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const coverGeometry = new THREE.PlaneGeometry(1.98, 1.98);
    const edgeGeometry = new THREE.BoxGeometry(2, 2, 0.025);
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#e2e5e4', roughness: 0.8 });
    let slots: { object: THREE.Group; offset: number; material: THREE.MeshBasicMaterial; backMaterial?: THREE.MeshBasicMaterial }[] = [];
    function textureFor(product: CrateCover) {
      const cached = textures.get(product.id);
      if (cached) return cached;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#deeaec'; ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = '#263e40'; ctx.font = 'bold 25px Arial'; ctx.textAlign = 'center';
      const words = product.title.split(' '); let row = '', y = 200;
      for (const word of words) {
        if (ctx.measureText(`${row} ${word}`).width > 420) { ctx.fillText(row, 256, y); y += 34; row = word; }
        else row = `${row} ${word}`.trim();
      }
      ctx.fillText(row, 256, y);
      const placeholder = new THREE.CanvasTexture(canvas); placeholder.colorSpace = THREE.SRGBColorSpace;
      textures.set(product.id, placeholder);
      if (product.image && !product.image.includes('placeholder')) {
        const imageUrl = /^https?:\/\//i.test(product.image)
          ? `/api/imgproxy?url=${encodeURIComponent(product.image)}` : product.image;
        loader.load(imageUrl, (loaded) => {
          if (disposed || textures.get(product.id) !== placeholder) { loaded.dispose(); return; }
          const image = loaded.image as HTMLImageElement;
          const resolution = /:(front|back)$/.test(product.id) ? Math.min(1536, Math.max(image.width, image.height)) : 512;
          const resized = document.createElement('canvas'); resized.width = resized.height = resolution;
          const context = resized.getContext('2d')!;
          context.fillStyle = '#ffffff'; context.fillRect(0, 0, resolution, resolution);
          const scale = Math.min(resolution / image.width, resolution / image.height);
          context.drawImage(image, (resolution - image.width * scale) / 2, (resolution - image.height * scale) / 2, image.width * scale, image.height * scale);
          loaded.image = resized; loaded.needsUpdate = true;
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          textures.set(product.id, loaded);
          for (const slot of slots) {
            const material = slot.object.userData.frontKey === product.id ? slot.material
              : `${slot.object.userData.id}:back` === product.id ? slot.backMaterial : undefined;
            if (material) { material.map = loaded; material.needsUpdate = true; }
          }
          placeholder.dispose(); dirty = true;
          element!.dataset.textures = String(Number(element!.dataset.textures || 0) + 1);
        }, undefined, () => { if (!disposed) { dirty = true; element!.dataset.missingCover = 'true'; } });
      }
      return placeholder;
    }
    function build(index: number, direction: number) {
      for (const slot of slots) { slot.material.dispose(); slot.backMaterial?.dispose(); }
      jackets.clear(); slots = [];
      const count = Math.min(8, covers.length);
      const start = direction < 0 ? -1 : 0;
      const active = new Set<string>();
      for (let i = start; i < count + start; i++) {
        const product = covers[(index + i + covers.length) % covers.length];
        active.add(product.id);
        const object = new THREE.Group(); object.userData.id = product.id;
        const frontKey = i === 0 ? `${product.id}:front` : product.id;
        object.userData.frontKey = frontKey; active.add(frontKey);
        const edge = new THREE.Mesh(edgeGeometry, edgeMaterial); edge.castShadow = true;
        const material = new THREE.MeshBasicMaterial({ map: textureFor({ ...product, id: frontKey }), side: THREE.FrontSide, toneMapped: false, transparent: true, depthWrite: false });
        const front = new THREE.Mesh(coverGeometry, material); front.position.z = 0.014;
        let backMaterial: THREE.MeshBasicMaterial | undefined;
        object.add(edge, front);
        if (i === 0 && product.backImage) {
          const id = `${product.id}:back`; active.add(id);
          backMaterial = new THREE.MeshBasicMaterial({ map: textureFor({ id, title: product.title, image: product.backImage }), toneMapped: false, transparent: true, depthWrite: false });
          const back = new THREE.Mesh(coverGeometry, backMaterial); back.position.z = -0.014; back.rotation.y = Math.PI;
          object.add(back);
        }
        jackets.add(object); slots.push({ object, offset: i, material, backMaterial });
      }
      // Bound GPU memory while browsing a large catalog.
      for (const [id, texture] of textures) if (/:(front|back)$/.test(id) && !active.has(id)) { texture.dispose(); textures.delete(id); }
      if (textures.size > 20) for (const [id, texture] of textures) {
        if (!active.has(id)) { texture.dispose(); textures.delete(id); }
        if (textures.size <= 16) break;
      }
      builtIndex = index; builtDirection = direction; dirty = true;
    }
    function position(progress: number, delta: number) {
      for (const slot of slots) {
        const depth = slot.offset - progress * delta;
        const out = Math.max(0, -depth);
        slot.object.position.set(0, 1.65 + Math.max(depth, 0) * 0.025 + Math.sin(out * Math.PI / 2) * 0.45, 0.67 - Math.max(depth, 0) * 0.27 + out * 2.8);
        slot.object.rotation.set(-0.08 - out * 0.35, slot.offset === 0 ? rotation : 0, 0);
        slot.object.scale.setScalar(slot.offset === 0 ? magnification : 1);
        slot.material.opacity = 1 - THREE.MathUtils.smoothstep(out, 0.55, 0.96);
        if (slot.backMaterial) slot.backMaterial.opacity = slot.material.opacity;
        slot.object.children[0].visible = out < 0.55;
        slot.object.visible = depth > -0.96 && depth < 7.5;
      }
    }
    const resize = () => {
      const width = element.clientWidth, height = element.clientHeight;
      renderer.setSize(width, height); camera.aspect = width / height;
      const distance = width <= 760
        ? Math.max(6.65, 3.4 / (2 * Math.tan(THREE.MathUtils.degToRad(18)) * camera.aspect * 0.7))
        : 6.65;
      camera.position.set(0, 3.45, distance);
      camera.lookAt(0, 1.25, 0); camera.updateProjectionMatrix(); dirty = true;
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; dirty = true; }); visibility.observe(element);
    function tick(time: number) {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const state = current.current;
      const dt = Math.min(0.05, (time - previousTime) / 1000); previousTime = time;
      const targetRotation = !state.move && state.showBack && covers[state.index]?.backImage ? Math.PI : 0;
      const targetZoom = state.move ? 1 : Math.max(1, Math.min(2.5, state.zoom / 100));
      if (Math.abs(rotation - targetRotation) > 0.001 || Math.abs(magnification - targetZoom) > 0.001) {
        rotation = reduceMotion.matches ? targetRotation : THREE.MathUtils.damp(rotation, targetRotation, 11, dt);
        magnification = reduceMotion.matches ? targetZoom : THREE.MathUtils.damp(magnification, targetZoom, 11, dt);
        dirty = true;
      } else { rotation = targetRotation; magnification = targetZoom; }
      element!.dataset.side = rotation > Math.PI / 2 ? 'back' : 'front';
      element!.dataset.rotating = String(Math.abs(rotation - targetRotation) > 0.005);
      element!.dataset.zoom = String(Math.round(magnification * 100));
      const direction = state.move?.delta || 0;
      if (builtIndex !== state.index || builtDirection !== direction) build(state.index, direction);
      if (state.move && completed !== state.move.serial) {
        if (serial !== state.move.serial) { serial = state.move.serial; started = time; }
        const t = Math.min(1, (time - started) / (reduceMotion.matches ? 120 : 720));
        const eased = t * t * (3 - 2 * t);
        position(eased, direction); dirty = true;
        element!.dataset.progress = eased.toFixed(3);
        if (t === 1) { completed = serial; state.onSettled(state.move.delta); }
      } else if (!state.move) position(0, 0);
      if (dirty) { renderer.render(scene, camera); dirty = false; element!.dataset.ready = 'true'; }
    }
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); visibility.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      for (const slot of slots) { slot.material.dispose(); slot.backMaterial?.dispose(); }
      coverGeometry.dispose(); edgeGeometry.dispose(); edgeMaterial.dispose();
      for (const texture of textures.values()) texture.dispose(); labelTexture.dispose();
      scene.traverse((object) => { if (object instanceof THREE.Mesh && object.parent !== jackets) object.geometry.dispose(); });
      wood.dispose(); darkWood.dispose(); (label.material as THREE.Material).dispose(); (floor.material as THREE.Material).dispose();
      light.shadow.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [covers, brand]);

  return <div ref={host} className="record-crate-scene" data-testid="crate-scene"
    style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'pan-y', cursor: move ? 'wait' : 'grab' }}
    onPointerDown={(event) => { if (!move) pointer.current = { x: event.clientX, y: event.clientY }; }}
    onPointerUp={(event) => {
      const start = pointer.current; pointer.current = null;
      if (!start || move) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) current.current.onSwipe(dx < 0 ? 1 : -1);
    }} onPointerCancel={() => { pointer.current = null; }} onPointerLeave={() => { pointer.current = null; }}>
    {unavailable && <div className="absolute inset-0 flex items-center justify-center overflow-auto bg-slate-50"><img src={showBack && covers[index]?.backImage ? covers[index].backImage : covers[index]?.image} alt={showBack ? 'Contraportada' : covers[index]?.title} className="max-h-[80%] max-w-[80%] object-contain" style={{ transform: `scale(${zoom / 100})` }} /></div>}
  </div>;
}
