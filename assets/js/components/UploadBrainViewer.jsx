import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { dominantUploadVoxel, projectUploadResponses, uploadResponseColor } from "../services/uploadBrainProjection.js";

export { projectUploadResponses, uploadResponseColor } from "../services/uploadBrainProjection.js";

const HEMISPHERES = ["lh", "rh"];
const DEFAULT_VIEWS = {
  FFA: "ventral", FBA: "ventral", PPA: "ventral", VWFA: "ventral",
  EBA: "lateral", OFA: "lateral", OPA: "lateral", RSC: "medial",
};
// The published surface already uses glTF Y-up coordinates. Do not rotate or
// reorder its vertices: the sparse mapper refers to their original indices.
const VIEWS = {
  lateral: { lh: [-1, 0, 0], rh: [1, 0, 0], up: [0, 1, 0] },
  medial: { lh: [1, 0, 0], rh: [-1, 0, 0], up: [0, 1, 0] },
  ventral: { lh: [0, -1, 0], rh: [0, -1, 0], up: [0, 0, -1] },
  dorsal: { lh: [0, 1, 0], rh: [0, 1, 0], up: [0, 0, -1] },
};
function disposeTree(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

function firstMesh(node) {
  if (node?.isMesh) return node;
  let mesh = null;
  node?.traverse((child) => { if (!mesh && child.isMesh) mesh = child; });
  return mesh;
}

function sha256(bytes) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("A secure browser context is required to verify the Subject 1 cortical surface.");
  }
  return globalThis.crypto.subtle.digest("SHA-256", bytes).then((digest) => (
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  ));
}

function matchingMesh(gltf, specification, hemisphere) {
  const mesh = firstMesh(gltf.scene.getObjectByName(specification.node));
  const position = mesh?.geometry.getAttribute("position");
  const index = mesh?.geometry.getIndex();
  if (!mesh || !position || !index
    || position.count !== specification.vertexCount
    || index.count !== specification.faceCount * 3
    || specification.sourceVertexOrderPreserved !== true) {
    throw new Error(`The ${hemisphere.toUpperCase()} surface topology does not match the Subject 1 projection.`);
  }
  return mesh;
}

function supportedTriangles(mesh, contributors) {
  const index = mesh.geometry.getIndex();
  const supported = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    if (contributors.has(a) || contributors.has(b) || contributors.has(c)) supported.push(a, b, c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", mesh.geometry.getAttribute("position"));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(supported), 1));
  // This proxy is never rendered. It cheaply rejects pointer positions outside
  // the ROI before the complete surface is tested for front-surface occlusion.
  return new THREE.Mesh(geometry, mesh.material);
}

function dominantSource(hit, contributors) {
  const position = hit.object.geometry.getAttribute("position");
  const point = hit.object.worldToLocal(hit.point.clone());
  const vertices = [hit.face.a, hit.face.b, hit.face.c];
  const triangle = vertices.map((vertex) => new THREE.Vector3().fromBufferAttribute(position, vertex));
  const barycentric = THREE.Triangle.getBarycoord(point, ...triangle, new THREE.Vector3());
  if (!barycentric) return null;
  return dominantUploadVoxel(vertices, [barycentric.x, barycentric.y, barycentric.z], contributors);
}

export default function UploadBrainViewer({ mapping, roi, values, range, onVoxelHover }) {
  const mountRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const runtimeRef = useRef(null);
  const callbackRef = useRef(onVoxelHover);
  const dataRef = useRef({ roi, values, range });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [view, setView] = useState(DEFAULT_VIEWS[roi?.label] || "lateral");

  useEffect(() => { callbackRef.current = onVoxelHover; }, [onVoxelHover]);

  useEffect(() => {
    dataRef.current = { roi, values, range };
    const runtime = runtimeRef.current;
    if (!runtime?.ready) return;
    try {
      runtime.applyData(dataRef.current);
      setStatus("ready");
      setError("");
    } catch (cause) {
      // Invalid new data must not leave a previous image's colors on screen.
      runtime.clearData();
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "The prediction could not be projected.");
    }
  }, [roi, values, range]);

  useEffect(() => {
    const mount = mountRef.current;
    const pads = { lh: leftRef.current, rh: rightRef.current };
    if (!mount || !pads.lh || !pads.rh) return undefined;
    let cancelled = false;
    let frameId = 0;
    let needsRender = true;
    let lastHover = null;
    let pointerEvent = null;
    let lastPointerTime = 0;
    let dragging = false;
    const abortController = new AbortController();
    const scene = new THREE.Scene();
    const objects = {};
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const entries = [];
    let renderer;
    setStatus("loading");
    setError("");

    const reportHover = (responseIndex) => {
      if (lastHover === responseIndex) return;
      lastHover = responseIndex;
      callbackRef.current?.(responseIndex);
    };
    callbackRef.current?.(null);

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setStatus("error");
      setError("This browser cannot display the 3D brain. Enable WebGL or hardware acceleration and reload.");
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    Object.assign(renderer.domElement.style, {
      position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none",
    });
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);
    // Keep response colors visible when inspecting the ventral (underside) view.
    scene.add(new THREE.AmbientLight(0xffffff, 2));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x77736c, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2.4);
    light.position.set(0, 2, 3);
    scene.add(light);

    for (const hemisphere of HEMISPHERES) {
      const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 100);
      const controls = new OrbitControls(camera, pads[hemisphere]);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.minDistance = 1;
      controls.maxDistance = 12;
      controls.screenSpacePanning = true;
      controls.addEventListener("change", () => {
        needsRender = true;
        pointerEvent = null;
        reportHover(null);
      });
      const group = new THREE.Group();
      scene.add(group);
      objects[hemisphere] = { camera, controls, group, mesh: null, proxy: null, radius: 1, fittedDistance: 0 };
    }

    const layout = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      const gap = 8;
      const hemisphereWidth = Math.max((width - gap) / 2, 1);
      return { width, height, gap, hemisphereWidth };
    };

    const fitDistance = (object) => {
      const verticalHalfAngle = THREE.MathUtils.degToRad(object.camera.fov / 2);
      const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * object.camera.aspect);
      return object.radius / Math.sin(Math.min(verticalHalfAngle, horizontalHalfAngle)) * 1.12;
    };

    const applyView = (name) => {
      const specification = VIEWS[name];
      if (!specification) return;
      for (const hemisphere of HEMISPHERES) {
        const object = objects[hemisphere];
        const { camera, controls } = object;
        const distance = fitDistance(object);
        object.fittedDistance = distance;
        controls.maxDistance = Math.max(12, distance * 3);
        camera.far = Math.max(100, distance * 5);
        camera.position.fromArray(specification[hemisphere]).multiplyScalar(distance);
        camera.up.fromArray(specification.up);
        controls.target.set(0, 0, 0);
        camera.lookAt(controls.target);
        controls.update();
      }
      reportHover(null);
      pointerEvent = null;
      needsRender = true;
      setView(name);
    };

    const clearData = () => {
      for (const object of Object.values(objects)) {
        if (!object.mesh) continue;
        object.mesh.geometry.getAttribute("color").array.set(object.baseColors);
        object.mesh.geometry.getAttribute("color").needsUpdate = true;
        object.proxy?.geometry.dispose();
        object.proxy = null;
        object.contributors = new Map();
      }
      reportHover(null);
      needsRender = true;
    };

    const applyData = (data) => {
      if (!Array.isArray(data.range) || data.range.length !== 2 || !data.range.every(Number.isFinite)) {
        throw new Error("The predicted-response color range is invalid.");
      }
      const projected = HEMISPHERES.map((hemisphere) => projectUploadResponses(
        data.roi, hemisphere, data.values, objects[hemisphere].mesh.geometry.getAttribute("position").count,
      ));
      HEMISPHERES.forEach((hemisphere, index) => {
        const object = objects[hemisphere];
        const projection = projected[index];
        const attribute = object.mesh.geometry.getAttribute("color");
        attribute.array.set(object.baseColors);
        const color = new THREE.Color();
        for (const vertex of projection.contributors.keys()) {
          uploadResponseColor(projection.values[vertex], data.range, color).toArray(attribute.array, vertex * 3);
        }
        attribute.needsUpdate = true;
        object.contributors = projection.contributors;
        object.proxy?.geometry.dispose();
        object.proxy = supportedTriangles(object.mesh, projection.contributors);
      });
      reportHover(null);
      pointerEvent = null;
      needsRender = true;
    };

    const resize = () => {
      const { width, height, gap, hemisphereWidth } = layout();
      renderer.setSize(width, height, false);
      HEMISPHERES.forEach((hemisphere, index) => {
        pads[hemisphere].style.left = `${index * (hemisphereWidth + gap)}px`;
        pads[hemisphere].style.width = `${hemisphereWidth}px`;
        const object = objects[hemisphere];
        object.camera.aspect = hemisphereWidth / height;
        if (object.fittedDistance > 0) {
          const distance = fitDistance(object);
          object.camera.position.sub(object.controls.target)
            .multiplyScalar(distance / object.fittedDistance).add(object.controls.target);
          object.fittedDistance = distance;
          object.controls.maxDistance = Math.max(12, distance * 3);
          object.camera.far = Math.max(100, distance * 5);
          object.controls.update();
        }
        object.camera.updateProjectionMatrix();
      });
      // Resize is a framing change, not a new stimulus. Keep the active view.
      needsRender = true;
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const contextLost = (event) => {
      event.preventDefault();
      window.cancelAnimationFrame(frameId);
      reportHover(null);
      setStatus("error");
      setError("The browser lost its 3D graphics context. Reload to restore the brain view.");
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);

    for (const hemisphere of HEMISPHERES) {
      const pad = pads[hemisphere];
      const move = (event) => { pointerEvent = { hemisphere, x: event.clientX, y: event.clientY }; };
      const leave = () => { pointerEvent = null; reportHover(null); };
      const down = () => { dragging = true; leave(); };
      const key = (event) => {
        const { camera, controls } = objects[hemisphere];
        const offset = camera.position.clone().sub(controls.target);
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
          const axis = horizontal ? camera.up.clone().normalize() : offset.clone().cross(camera.up).normalize();
          const sign = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
          offset.applyAxisAngle(axis, sign * Math.PI / 36);
        } else if (["+", "=", "-", "_"].includes(event.key)) {
          offset.multiplyScalar(event.key === "+" || event.key === "=" ? 0.9 : 1.1);
        } else if (event.key === "Home") {
          applyView(DEFAULT_VIEWS[dataRef.current.roi?.label] || "lateral");
        } else if (event.key === "Escape") {
          leave();
          return;
        } else return;
        event.preventDefault();
        if (event.key !== "Home") camera.position.copy(controls.target).add(offset);
        controls.update();
        leave();
        needsRender = true;
      };
      for (const [name, handler] of [["pointermove", move], ["pointerleave", leave], ["pointerdown", down], ["keydown", key]]) {
        pad.addEventListener(name, handler);
        entries.push([pad, name, handler]);
      }
    }
    const pointerUp = () => { dragging = false; };
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);

    const inspectPointer = () => {
      if (!pointerEvent || dragging) return;
      const { hemisphere, x, y } = pointerEvent;
      const object = objects[hemisphere];
      if (!object.proxy) return;
      const rect = pads[hemisphere].getBoundingClientRect();
      pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      object.group.updateMatrixWorld(true);
      object.proxy.matrixWorld.copy(object.mesh.matrixWorld);
      raycaster.setFromCamera(pointer, object.camera);
      if (!raycaster.intersectObject(object.proxy, false).length) {
        reportHover(null);
        return;
      }
      const hit = raycaster.intersectObject(object.mesh, false)[0];
      reportHover(hit?.face ? dominantSource(hit, object.contributors) : null);
    };

    const animate = (time) => {
      if (cancelled) return;
      for (const object of Object.values(objects)) object.controls.update();
      if (pointerEvent && time - lastPointerTime > 100) {
        lastPointerTime = time;
        inspectPointer();
        // Inspect each pointer position once, rather than continuously scanning
        // the high-resolution cortex while the pointer rests over a voxel.
        pointerEvent = null;
      }
      if (needsRender) {
        const { height, gap, hemisphereWidth } = layout();
        renderer.setScissorTest(true);
        HEMISPHERES.forEach((hemisphere, index) => {
          for (const name of HEMISPHERES) objects[name].group.visible = name === hemisphere;
          const x = index * (hemisphereWidth + gap);
          renderer.setViewport(x, 0, hemisphereWidth, height);
          renderer.setScissor(x, 0, hemisphereWidth, height);
          renderer.render(scene, objects[hemisphere].camera);
        });
        needsRender = false;
      }
      frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);

    const runtime = { ready: false, applyData, clearData, applyView };
    runtimeRef.current = runtime;
    const load = async () => {
      let gltf;
      try {
        const surface = mapping?.surface;
        if (!surface?.url || !surface.sha256 || !surface.hemispheres) {
          throw new Error("The Subject 1 cortical surface metadata is missing.");
        }
        const response = await fetch(surface.url, { signal: abortController.signal });
        if (!response.ok) throw new Error("The Subject 1 cortical surface could not be loaded.");
        const bytes = await response.arrayBuffer();
        if (await sha256(bytes) !== surface.sha256) {
          throw new Error("The cortical surface failed its integrity check; no predictions were plotted.");
        }
        if (cancelled) return;
        gltf = await new GLTFLoader().parseAsync(bytes, new URL(".", new URL(surface.url, window.location.href)).href);
        if (cancelled) { disposeTree(gltf.scene); return; }
        gltf.scene.updateMatrixWorld(true);
        for (const hemisphere of HEMISPHERES) {
          const source = matchingMesh(gltf, surface.hemispheres[hemisphere], hemisphere);
          const geometry = source.geometry.clone();
          if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
          const sourceColors = geometry.getAttribute("color");
          const colors = new Float32Array(geometry.getAttribute("position").count * 3);
          const grey = new THREE.Color("#cbc6bd");
          for (let vertex = 0; vertex < colors.length / 3; vertex += 1) {
            const shade = sourceColors ? THREE.MathUtils.clamp(sourceColors.getX(vertex), 0.35, 0.85) : 0.7;
            colors[vertex * 3] = grey.r * shade;
            colors[vertex * 3 + 1] = grey.g * shade;
            colors[vertex * 3 + 2] = grey.b * shade;
          }
          geometry.setAttribute("color", new THREE.BufferAttribute(colors.slice(), 3));
          const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
            color: "#ffffff", roughness: 0.95, metalness: 0, vertexColors: true, side: THREE.DoubleSide,
          }));
          mesh.applyMatrix4(source.matrixWorld);
          const object = objects[hemisphere];
          object.mesh = mesh;
          object.baseColors = colors;
          object.group.add(mesh);
          const box = new THREE.Box3().setFromObject(object.group);
          const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
          object.group.position.sub(box.getCenter(new THREE.Vector3()));
          object.group.scale.setScalar(1.1 / radius);
          object.group.position.multiplyScalar(1.1 / radius);
          object.radius = 1.1;
        }
        // Only copied base meshes enter the scene. Categorical roi_* nodes from
        // the existing anatomical explainer are deliberately never displayed.
        disposeTree(gltf.scene);
        gltf = null;
        runtime.ready = true;
        applyData(dataRef.current);
        const initialView = DEFAULT_VIEWS[dataRef.current.roi?.label] || "lateral";
        applyView(initialView);
        setView(initialView);
        setStatus("ready");
      } catch (cause) {
        if (gltf) disposeTree(gltf.scene);
        if (cancelled || cause?.name === "AbortError") return;
        clearData();
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "The cortical surface could not be prepared.");
      }
    };
    load();

    return () => {
      cancelled = true;
      abortController.abort();
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      entries.forEach(([element, name, handler]) => element.removeEventListener(name, handler));
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      for (const object of Object.values(objects)) {
        object.controls.dispose();
        object.proxy?.geometry.dispose();
      }
      disposeTree(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, [mapping]);

  const changeView = (nextView) => {
    setView(nextView);
    runtimeRef.current?.applyView(nextView);
  };

  return (
    <div className="upload-brain-viewer" style={{ position: "relative", width: "100%" }}>
      <div ref={mountRef} className="upload-brain-canvas" style={{ position: "relative", height: 400 }}>
        {[leftRef, rightRef].map((ref, index) => (
          <div
            key={index}
            ref={ref}
            className="upload-brain-pad"
            tabIndex={0}
            role="img"
            aria-label={`${index === 0 ? "Left" : "Right"} cortical hemisphere. Drag to rotate, scroll to zoom, or use arrow keys and plus or minus.`}
            style={{ position: "absolute", top: 0, bottom: 0, cursor: "grab", touchAction: "none" }}
          >
            <span style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", pointerEvents: "none", fontSize: 12 }}>
              {index === 0 ? "Left hemisphere" : "Right hemisphere"}
            </span>
          </div>
        ))}
      </div>
      <div className="upload-brain-view-controls" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label>
          View{" "}
          <select aria-label="Brain view" value={view} disabled={status !== "ready"} onChange={(event) => changeView(event.target.value)}>
            {Object.keys(VIEWS).map((name) => <option key={name} value={name}>{name[0].toUpperCase() + name.slice(1)}</option>)}
          </select>
        </label>
        <button type="button" disabled={status !== "ready"} onClick={() => changeView(DEFAULT_VIEWS[roi?.label] || "lateral")}>
          Reset view
        </button>
      </div>
      {status !== "ready" && (
        <div className="upload-brain-status" role="status" style={{ position: "absolute", top: 160, left: 20, right: 20, padding: 16, textAlign: "center", background: "var(--surface, #f7f5ef)" }}>
          {status === "error" ? error : "Loading Subject 1 cortical surface…"}
        </div>
      )}
    </div>
  );
}
