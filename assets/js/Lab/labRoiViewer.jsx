import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
const MODEL_PATH = "/assets/brainModel/subj01_froi_t7.glb?v=1";
const SOLO_COLOR = "#8E6FBF";
const TARGET_SIZE = 1.9;
const OUTLINE_LIFT = 0.012;

const ROI_VIEW = {
  ffa: "ventral",
  ofa: "lateral",
  eba: "lateral",
  fba: "ventral",
  ppa: "ventral",
  opa: "lateral",
  rsc: "medial",
  vwfa: "ventral",
};

// After the exporter's RAS → Y-up turn: X is left-right, Y is inferior-superior, Z is anterior-posterior (negated).
const VIEWS = {
  // Lateral/medial put the long anterior-posterior axis across the viewport, so they
  // need more distance than ventral/dorsal or the poles get clipped.
  lateral: { left: [-1, 0, 0], right: [1, 0, 0], up: [0, 1, 0], distance: 3.7 },
  medial: { left: [1, 0, 0], right: [-1, 0, 0], up: [0, 1, 0], distance: 3.7 },
  ventral: { left: [0, -1, 0], right: [0, -1, 0], up: [0, 0, -1], distance: 3.35, mirror: true },
  dorsal: { left: [0, 1, 0], right: [0, 1, 0], up: [0, 0, -1], distance: 3.35 },
};

const VIEW_ORDER = ["lateral", "medial", "ventral", "dorsal"];

function roiKey(name) {
  return (name || "").toLowerCase();
}

function boundaryOutline(geometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!position || !index) return null;

  const counts = new Map();
  const addEdge = (a, b) => {
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }

  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal");
  const points = [];
  counts.forEach((n, key) => {
    if (n !== 1) return;
    const [i, j] = key.split(",").map(Number);
    for (const vertex of [i, j]) {
      points.push(
        position.getX(vertex) + normal.getX(vertex) * OUTLINE_LIFT,
        position.getY(vertex) + normal.getY(vertex) * OUTLINE_LIFT,
        position.getZ(vertex) + normal.getZ(vertex) * OUTLINE_LIFT,
      );
    }
  });
  if (!points.length) return null;

  const line = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(points, 3)),
    new THREE.LineBasicMaterial({ color: 0x111111, depthTest: true }),
  );
  line.renderOrder = 2;
  line.visible = false;
  return line;
}

function parseMeshName(name) {
  const match = /^(base|roi)_(lh|rh)(?:_([A-Z]+))?$/.exec(name || "");
  if (!match) return null;
  return { kind: match[1], hemi: match[2], roi: match[3] || null };
}

function placeCamera(camera, controls, eye, up, distance) {
  camera.up.set(up[0], up[1], up[2]);
  camera.position.set(eye[0] * distance, eye[1] * distance, eye[2] * distance);
  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);
  controls.update();
}

function makeControls(camera, dom) {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.75;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.panSpeed = 1.1;
  controls.minDistance = 1.2;
  controls.maxDistance = 6.5;
  controls.autoRotate = false;
  controls.target.set(0, 0, 0);
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };
  return controls;
}

function makeCamera() {
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(-2.45, 0, 0);
  return camera;
}

export default function LabRoiViewer({ region }) {
  const mountRef = useRef(null);
  const leftPadRef = useRef(null);
  const rightPadRef = useRef(null);
  const apiRef = useRef(null);
  const regionRef = useRef(region);
  regionRef.current = region;
  const [status, setStatus] = useState("loading");
  const [view, setView] = useState(ROI_VIEW[roiKey(region)] || "lateral");
  const [helpOpen, setHelpOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const helpRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const leftPad = leftPadRef.current;
    const rightPad = rightPadRef.current;
    if (!mount || !leftPad || !rightPad) return undefined;

    const scene = new THREE.Scene();
    const leftCamera = makeCamera();
    const rightCamera = makeCamera();
    rightCamera.position.set(2.45, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.pointerEvents = "none";
    mount.appendChild(renderer.domElement);

    const leftControls = makeControls(leftCamera, leftPad);
    const rightControls = makeControls(rightCamera, rightPad);

    const lhGroup = new THREE.Group();
    const rhGroup = new THREE.Group();
    scene.add(lhGroup, rhGroup);

    const roiMeshes = new Map();
    let hemiScale = 1;

    const applyView = (name) => {
      const spec = VIEWS[name];
      if (!spec) return;
      placeCamera(leftCamera, leftControls, spec.left, spec.up, spec.distance);
      placeCamera(rightCamera, rightControls, spec.right, spec.up, spec.distance);
      // From below, anterior-up swaps left/right. Mirror both hemis so the
      // medial walls face the gap the same way they do on dorsal.
      const sx = spec.mirror ? -hemiScale : hemiScale;
      lhGroup.scale.set(sx, hemiScale, hemiScale);
      rhGroup.scale.set(sx, hemiScale, hemiScale);
    };

    const setPanWithShift = (on) => {
      const button = on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
      leftControls.mouseButtons.LEFT = button;
      rightControls.mouseButtons.LEFT = button;
    };
    const onKeyDown = (event) => {
      if (event.key === "Shift") setPanWithShift(true);
    };
    const onKeyUp = (event) => {
      if (event.key === "Shift") setPanWithShift(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const blockMenu = (event) => event.preventDefault();
    leftPad.addEventListener("contextmenu", blockMenu);
    rightPad.addEventListener("contextmenu", blockMenu);

    const highlight = (name) => {
      const selected = (name || "").toUpperCase();
      roiMeshes.forEach((meshes, roi) => {
        const on = roi === selected;
        meshes.forEach((mesh) => {
          mesh.visible = on;
          if (mesh.userData.outline) mesh.userData.outline.visible = on;
        });
      });
    };

    const loader = new GLTFLoader();
    loader.load(
      MODEL_PATH,
      (gltf) => {
        if (!mount.isConnected) return;
        const meshes = [];
        gltf.scene.traverse((child) => {
          if (child.isMesh) meshes.push(child);
        });
        meshes.forEach((child) => {
          const parsed = parseMeshName(child.name) || parseMeshName(child.parent?.name);
          if (!parsed) return;
          const solo = parsed.kind === "roi";
          child.material = new THREE.MeshBasicMaterial({
            vertexColors: !solo,
            color: solo ? SOLO_COLOR : 0xffffff,
            side: THREE.DoubleSide,
            depthWrite: true,
            polygonOffset: solo,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          });
          child.renderOrder = parsed.kind === "roi" ? 1 : 0;
          if (parsed.kind === "roi") {
            const outline = boundaryOutline(child.geometry);
            if (outline) {
              child.add(outline);
              child.userData.outline = outline;
            }
          }
          (parsed.hemi === "lh" ? lhGroup : rhGroup).add(child);
          if (parsed.kind === "roi" && parsed.roi) {
            const list = roiMeshes.get(parsed.roi) || [];
            list.push(child);
            roiMeshes.set(parsed.roi, list);
          }
        });
        const maxDim = Math.max(
          ...[lhGroup, rhGroup].map((group) => {
            const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
            return Math.max(size.x, size.y, size.z, 1);
          }),
        );
        hemiScale = TARGET_SIZE / maxDim;
        [lhGroup, rhGroup].forEach((group) => {
          group.scale.setScalar(hemiScale);
          const fitted = new THREE.Box3().setFromObject(group);
          group.position.sub(fitted.getCenter(new THREE.Vector3()));
        });
        highlight(regionRef.current);
        applyView(ROI_VIEW[roiKey(regionRef.current)] || "lateral");
        setStatus("ready");
      },
      undefined,
      () => setStatus("error"),
    );

    const hemiLayout = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      const gap = 10;
      const hemiW = Math.max(
        120,
        Math.min(Math.round(height * 0.92), Math.floor((width - gap) / 2) - 24),
      );
      const x0 = Math.floor((width - hemiW * 2 - gap) / 2);
      return { width, height, gap, hemiW, x0 };
    };

    const setSize = () => {
      const { width, height, hemiW, x0, gap } = hemiLayout();
      renderer.setSize(width, height, false);
      leftPad.style.left = `${x0}px`;
      leftPad.style.width = `${hemiW}px`;
      rightPad.style.left = `${x0 + hemiW + gap}px`;
      rightPad.style.width = `${hemiW}px`;
    };
    setSize();
    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(mount);

    let frameId = 0;
    const animate = () => {
      leftControls.update();
      rightControls.update();

      const { height, hemiW, x0, gap } = hemiLayout();
      renderer.setScissorTest(true);
      lhGroup.visible = true;
      rhGroup.visible = false;
      leftCamera.aspect = hemiW / height;
      leftCamera.updateProjectionMatrix();
      renderer.setViewport(x0, 0, hemiW, height);
      renderer.setScissor(x0, 0, hemiW, height);
      renderer.render(scene, leftCamera);

      lhGroup.visible = false;
      rhGroup.visible = true;
      rightCamera.aspect = hemiW / height;
      rightCamera.updateProjectionMatrix();
      renderer.setViewport(x0 + hemiW + gap, 0, hemiW, height);
      renderer.setScissor(x0 + hemiW + gap, 0, hemiW, height);
      renderer.render(scene, rightCamera);

      frameId = window.requestAnimationFrame(animate);
    };
    animate();

    apiRef.current = { highlight, applyView };

    return () => {
      apiRef.current = null;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      leftPad.removeEventListener("contextmenu", blockMenu);
      rightPad.removeEventListener("contextmenu", blockMenu);
      leftControls.dispose();
      rightControls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    // region is applied through apiRef so the scene is not rebuilt on each click
  }, []);

  useEffect(() => {
    if (!apiRef.current) return;
    apiRef.current.highlight(region);
    const next = ROI_VIEW[roiKey(region)] || "lateral";
    setView(next);
    apiRef.current.applyView(next);
  }, [region]);

  useEffect(() => {
    if (!helpOpen) return undefined;
    const onPointerDown = (event) => {
      if (!helpRef.current?.contains(event.target)) setHelpOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setHelpOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [helpOpen]);

  useEffect(() => {
    const onChange = () => {
      const node = rootRef.current;
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(Boolean(node && active === node));
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      if (!active) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const toggleFullscreen = async () => {
    const node = rootRef.current;
    if (!node) return;
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active === node) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) await exit.call(document);
      return;
    }
    if (isFullscreen) {
      setIsFullscreen(false);
      return;
    }
    const request = node.requestFullscreen || node.webkitRequestFullscreen;
    if (request) {
      try {
        await request.call(node);
        return;
      } catch {
        // Fall back to a fixed overlay if the browser blocks the Fullscreen API.
      }
    }
    setIsFullscreen(true);
  };

  const handleView = (name) => {
    setView(name);
    apiRef.current?.applyView(name);
  };

  return (
    <div
      ref={rootRef}
      className={`lab-roi-viewer${isFullscreen ? " is-fullscreen" : ""}`}
    >
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div ref={leftPadRef} className="lab-roi-pad">
        <span className="lab-roi-hemi-label">Left</span>
      </div>
      <div ref={rightPadRef} className="lab-roi-pad">
        <span className="lab-roi-hemi-label">Right</span>
      </div>
      <div className="lab-roi-toolbar">
        <div className="lab-roi-toolbar-start">
          <span className="lab-roi-threshold-label">T &gt; 7, NSD subject 1</span>
        </div>
        <div className="lab-roi-views">
          {VIEW_ORDER.map((name) => (
            <button
              key={name}
              type="button"
              className={view === name ? "is-active" : undefined}
              onClick={() => handleView(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="lab-roi-corner">
        <button
          type="button"
          className={isFullscreen ? "lab-roi-help-btn is-open" : "lab-roi-help-btn"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Open viewer fullscreen"}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? (
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
              <path
                d="M1 4h3V1M8 1v3h3M11 8H8v3M4 11V8H1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
              <path
                d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <div className="lab-roi-help" ref={helpRef}>
          {helpOpen && (
            <div className="lab-roi-help-panel" role="dialog" aria-label="Viewer help">
              <p className="lab-roi-help-kicker">Natural Scenes Dataset</p>
              <h3>NSD subject 1</h3>
              <p>
                Inflated fROI surface for subject 01. Select a region in the left
                menu to outline it.
              </p>
              <dl>
                <div>
                  <dt>Drag</dt>
                  <dd>Rotate that hemisphere</dd>
                </div>
                <div>
                  <dt>Scroll</dt>
                  <dd>Zoom</dd>
                </div>
                <div>
                  <dt>Right-drag or Shift-drag</dt>
                  <dd>Pan after zooming</dd>
                </div>
                <div>
                  <dt>Left / Right</dt>
                  <dd>Each hemisphere turns on its own</dd>
                </div>
                <div>
                  <dt>t &gt; 7</dt>
                  <dd>Each fROI uses the stricter definition</dd>
                </div>
                <div>
                  <dt>Fullscreen</dt>
                  <dd>Open the surface larger to rotate and inspect</dd>
                </div>
              </dl>
            </div>
          )}
          <button
            type="button"
            className={helpOpen ? "lab-roi-help-btn is-open" : "lab-roi-help-btn"}
            aria-label={helpOpen ? "Hide viewer help" : "Show viewer help"}
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((open) => !open)}
          >
            ?
          </button>
        </div>
      </div>
      {status === "loading" && <div className="lab-roi-status">Loading surface…</div>}
      {status === "error" && <div className="lab-roi-status">Could not load the surface.</div>}
    </div>
  );
}
