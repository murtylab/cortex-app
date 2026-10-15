import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { dominantUploadVoxel, projectUploadResponses, uploadResponseColor } from "../services/uploadBrainProjection.js";

export { projectUploadResponses, uploadResponseColor } from "../services/uploadBrainProjection.js";

const HEMISPHERES = ["lh", "rh"];
// Display transforms never reorder the verified mapper's surface vertices.
const VIEWS = {
  overview: { direction: [0.9, 0.28, 1.35], up: [0, 1, 0] },
  lateral: { direction: [1, 0, 0], up: [0, 1, 0] },
  medial: { direction: [-1, 0, 0], up: [0, 1, 0] },
  ventral: { direction: [0, -1, 0], up: [0, 0, -1] },
  dorsal: { direction: [0, 1, 0], up: [0, 0, -1] },
};
const VIEW_LABELS = {
  overview: "Overview", lateral: "Right side", medial: "Left side", ventral: "Ventral", dorsal: "Dorsal",
};
// Start ventral regions from below, as in the original compact panel.
const DEFAULT_VIEWS = { FFA: "ventral", FBA: "ventral", PPA: "ventral", VWFA: "ventral" };

function disposeTree(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
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
  // Never rendered: first reject pointers outside the mapped ROI, then check
  // the complete shared surface for nearer, occluding cortex.
  return new THREE.Mesh(geometry, mesh.material);
}

function hoverDatum(hit, object, canvasX, canvasY) {
  const position = hit.object.geometry.getAttribute("position");
  const point = hit.object.worldToLocal(hit.point.clone());
  const vertices = [hit.face.a, hit.face.b, hit.face.c];
  const triangle = vertices.map((vertex) => new THREE.Vector3().fromBufferAttribute(position, vertex));
  const barycentric = THREE.Triangle.getBarycoord(point, ...triangle, new THREE.Vector3());
  if (!barycentric) return null;
  const weights = [barycentric.x, barycentric.y, barycentric.z];
  const responseIndex = dominantUploadVoxel(vertices, weights, object.contributors);
  if (responseIndex === null) return null;
  let surfaceValue = 0;
  let mappedWeight = 0;
  let vertexIndex = null;
  let strongestVertexWeight = -1;
  vertices.forEach((vertex, index) => {
    if (!object.contributors.has(vertex)) return;
    const weight = Math.max(0, weights[index]);
    surfaceValue += object.projectedValues[vertex] * weight;
    mappedWeight += weight;
    if (weight > strongestVertexWeight) {
      strongestVertexWeight = weight;
      vertexIndex = vertex;
    }
  });
  return {
    responseIndex, hemisphere: object.hemisphere, canvasX, canvasY,
    surfaceValue: mappedWeight > 0 ? surfaceValue / mappedWeight : null,
    vertexIndex,
  };
}

export default function UploadBrainViewer({ mapping, roi, values, range, onVoxelHover, hemisphereMode = "both" }) {
  const mountRef = useRef(null);
  const runtimeRef = useRef(null);
  const callbackRef = useRef(onVoxelHover);
  const dataRef = useRef({ roi, values, range });
  const viewRef = useRef(DEFAULT_VIEWS[roi?.label] || "overview");
  const modeRef = useRef(hemisphereMode);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [view, setView] = useState(DEFAULT_VIEWS[roi?.label] || "overview");

  useEffect(() => { callbackRef.current = onVoxelHover; }, [onVoxelHover]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { modeRef.current = hemisphereMode; }, [hemisphereMode]);
  useEffect(() => {
    const nextView = DEFAULT_VIEWS[roi?.label] || "overview";
    setView(nextView);
    viewRef.current = nextView;
    runtimeRef.current?.applyView(nextView);
  }, [roi?.label]);

  useEffect(() => {
    dataRef.current = { roi, values, range };
    const runtime = runtimeRef.current;
    if (!runtime?.ready) return;
    try {
      runtime.applyData(dataRef.current);
      setStatus("ready");
      setError("");
    } catch (cause) {
      // Never leave the previous image's colors visible after invalid new data.
      runtime.clearData();
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "The prediction could not be projected.");
    }
  }, [roi, values, range]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let cancelled = false;
    let graphicsLost = false;
    let frameId = 0;
    let needsRender = true;
    let lastHover = null;
    let pointerEvent = null;
    let lastPointerTime = 0;
    let dragging = false;
    let radius = 0;
    let fittedDistance = 0;
    const abortController = new AbortController();
    const scene = new THREE.Scene();
    // Keep the cortical surface on the Lab page rather than in a boxed stage.
    scene.background = null;
    const surfaceRoot = new THREE.Group();
    scene.add(surfaceRoot);
    const objects = [];
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector3();
    const entries = [];
    let renderer;
    setStatus("loading");
    setError("");

    const reportHover = (datum) => {
      if (!datum && !lastHover) return;
      if (datum && lastHover && datum.responseIndex === lastHover.responseIndex
        && datum.hemisphere === lastHover.hemisphere
        && datum.canvasX === lastHover.canvasX && datum.canvasY === lastHover.canvasY) return;
      lastHover = datum;
      callbackRef.current?.(datum);
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
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "upload-brain-webgl-canvas";
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "Interactive Subject 1 cortical surface. Drag to rotate, scroll to zoom, or use arrow keys and plus or minus.");
    mount.appendChild(renderer.domElement);

    // Ground matches the sky closely: ventral faces point down, so a dark
    // ground color leaves that view almost unlit.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe4dfd6, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(1, 1.4, 1.8);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xa8b7dc, 1.2);
    fillLight.position.set(-1.5, 0.2, -1);
    scene.add(fillLight);
    const undersideLight = new THREE.DirectionalLight(0xfff6ee, 2.2);
    undersideLight.position.set(0.2, -1.6, 0.45);
    scene.add(undersideLight);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 3000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 35;
    controls.maxDistance = 850;
    controls.addEventListener("change", () => {
      needsRender = true;
      pointerEvent = null;
      reportHover(null);
    });

    const fitDistance = () => {
      const verticalHalfAngle = THREE.MathUtils.degToRad(camera.fov / 2);
      const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * camera.aspect);
      return radius / Math.sin(Math.min(verticalHalfAngle, horizontalHalfAngle)) * 1.1;
    };
    const applyView = (name) => {
      if (!radius) return;
      const specification = VIEWS[name] || VIEWS.overview;
      const distance = fitDistance();
      fittedDistance = distance;
      controls.minDistance = Math.max(5, radius * 0.25);
      controls.maxDistance = Math.max(850, distance * 2);
      camera.far = Math.max(3000, distance + radius * 4);
      camera.up.fromArray(specification.up);
      camera.position.copy(center).add(new THREE.Vector3().fromArray(specification.direction).normalize().multiplyScalar(distance));
      controls.target.copy(center);
      camera.updateProjectionMatrix();
      controls.update();
      pointerEvent = null;
      reportHover(null);
      needsRender = true;
    };
    const applyMode = (mode) => {
      if (!objects.length) return;
      const selectedMode = HEMISPHERES.includes(mode) ? mode : "both";
      const box = new THREE.Box3();
      for (const object of objects) {
        object.mesh.visible = selectedMode === "both" || object.hemisphere === selectedMode;
        if (object.mesh.visible) box.expandByObject(object.mesh);
      }
      box.getCenter(center);
      radius = box.getBoundingSphere(new THREE.Sphere()).radius;
      if (!Number.isFinite(radius) || radius <= 0) throw new Error("The cortical surface bounds are invalid.");
      applyView(viewRef.current);
    };

    const clearData = () => {
      for (const object of objects) {
        const attribute = object.mesh.geometry.getAttribute("color");
        attribute.array.set(object.baseColors);
        attribute.needsUpdate = true;
        object.proxy?.geometry.dispose();
        object.proxy = null;
        object.contributors = new Map();
        object.projectedValues = null;
      }
      pointerEvent = null;
      reportHover(null);
      needsRender = true;
    };
    const applyData = (data) => {
      if (!Array.isArray(data.range) || data.range.length !== 2 || !data.range.every(Number.isFinite)) {
        throw new Error("The predicted-response color range is invalid.");
      }
      // Validate both projections before changing either hemisphere.
      const projected = objects.map((object) => projectUploadResponses(
        data.roi, object.hemisphere, data.values, object.mesh.geometry.getAttribute("position").count,
      ));
      objects.forEach((object, index) => {
        const projection = projected[index];
        const attribute = object.mesh.geometry.getAttribute("color");
        attribute.array.set(object.baseColors);
        const color = new THREE.Color();
        for (const vertex of projection.contributors.keys()) {
          uploadResponseColor(projection.values[vertex], data.range, color).toArray(attribute.array, vertex * 3);
        }
        attribute.needsUpdate = true;
        object.contributors = projection.contributors;
        object.projectedValues = projection.values;
        object.proxy?.geometry.dispose();
        object.proxy = supportedTriangles(object.mesh, projection.contributors);
      });
      pointerEvent = null;
      reportHover(null);
      needsRender = true;
    };

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (fittedDistance > 0) {
        const distance = fitDistance();
        camera.position.sub(controls.target).multiplyScalar(distance / fittedDistance).add(controls.target);
        fittedDistance = distance;
        controls.maxDistance = Math.max(850, distance * 2);
        camera.far = Math.max(3000, distance + radius * 4);
        controls.update();
      }
      camera.updateProjectionMatrix();
      pointerEvent = null;
      reportHover(null);
      needsRender = true;
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const listen = (element, name, handler) => {
      element.addEventListener(name, handler);
      entries.push([element, name, handler]);
    };
    const leave = () => { pointerEvent = null; reportHover(null); };
    listen(renderer.domElement, "pointermove", (event) => {
      pointerEvent = { x: event.clientX, y: event.clientY };
    });
    listen(renderer.domElement, "pointerleave", leave);
    listen(renderer.domElement, "pointerdown", () => { dragging = true; leave(); });
    const pointerUp = () => { dragging = false; };
    listen(window, "pointerup", pointerUp);
    listen(window, "pointercancel", pointerUp);
    listen(renderer.domElement, "keydown", (event) => {
      const offset = camera.position.clone().sub(controls.target);
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
        const axis = horizontal ? camera.up.clone().normalize() : offset.clone().cross(camera.up).normalize();
        const sign = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        offset.applyAxisAngle(axis, sign * Math.PI / 36);
      } else if (["+", "=", "-", "_"].includes(event.key)) {
        offset.multiplyScalar(event.key === "+" || event.key === "=" ? 0.9 : 1.1);
      } else if (event.key === "Home") {
        applyView(viewRef.current);
      } else if (event.key === "Escape") {
        leave();
        return;
      } else return;
      event.preventDefault();
      if (event.key !== "Home") camera.position.copy(controls.target).add(offset);
      controls.update();
      leave();
      needsRender = true;
    });
    listen(renderer.domElement, "webglcontextlost", (event) => {
      event.preventDefault();
      graphicsLost = true;
      if (runtimeRef.current?.renderer === renderer) runtimeRef.current.ready = false;
      window.cancelAnimationFrame(frameId);
      leave();
      setStatus("error");
      setError("The browser lost its 3D graphics context. Reload to restore the brain view.");
    });

    const inspectPointer = () => {
      if (!pointerEvent || dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const { x, y } = pointerEvent;
      pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      surfaceRoot.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(pointer, camera);
      const visible = objects.filter((object) => object.mesh.visible);
      const proxies = visible.filter((object) => object.proxy).map((object) => {
        object.proxy.matrixWorld.copy(object.mesh.matrixWorld);
        return object.proxy;
      });
      if (!raycaster.intersectObjects(proxies, false).length) {
        reportHover(null);
        renderer.domElement.style.cursor = "grab";
        return;
      }
      // All displayed cortex participates: a hidden ROI cannot be inspected
      // through unpredicted cortex or through the other visible hemisphere.
      const hit = raycaster.intersectObjects(visible.map((object) => object.mesh), false)[0];
      const object = hit && visible.find((candidate) => candidate.mesh === hit.object);
      const datum = object && hit.face ? hoverDatum(hit, object, x - rect.left, y - rect.top) : null;
      renderer.domElement.style.cursor = datum ? "crosshair" : "grab";
      reportHover(datum);
    };
    const animate = (time) => {
      if (cancelled) return;
      controls.update();
      if (pointerEvent && time - lastPointerTime > 100) {
        lastPointerTime = time;
        inspectPointer();
        pointerEvent = null;
      }
      if (needsRender) {
        renderer.render(scene, camera);
        needsRender = false;
      }
      frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);

    const runtime = { ready: false, renderer, applyData, clearData, applyView, applyMode };
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
        if (cancelled || graphicsLost) return;
        gltf = await new GLTFLoader().parseAsync(bytes, new URL(".", new URL(surface.url, window.location.href)).href);
        if (cancelled || graphicsLost) { disposeTree(gltf.scene); return; }
        gltf.scene.updateMatrixWorld(true);
        for (const hemisphere of HEMISPHERES) {
          const specification = surface.hemispheres[hemisphere];
          const source = matchingMesh(gltf, specification, hemisphere);
          const geometry = source.geometry.clone();
          if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
          const baseColors = new Float32Array(geometry.getAttribute("position").count * 3);
          const grey = new THREE.Color("#d8d3ca");
          for (let vertex = 0; vertex < baseColors.length / 3; vertex += 1) grey.toArray(baseColors, vertex * 3);
          geometry.setAttribute("color", new THREE.BufferAttribute(baseColors.slice(), 3));
          const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
            color: "#ffffff", roughness: 0.94, metalness: 0, vertexColors: true, side: THREE.DoubleSide,
          }));
          mesh.applyMatrix4(source.matrixWorld);
          // Restore native inflated hemisphere alignment before applying an
          // explicit display gap; this is translation only, not resampling.
          const translation = specification.sourceToGlbTranslationMm;
          if (!Array.isArray(translation) || translation.length !== 3 || !translation.every(Number.isFinite)) {
            geometry.dispose();
            mesh.material.dispose();
            throw new Error("The cortical hemisphere alignment metadata is invalid.");
          }
          mesh.position.sub(new THREE.Vector3().fromArray(translation));
          surfaceRoot.add(mesh);
          objects.push({ hemisphere, mesh, baseColors, proxy: null, contributors: new Map(), projectedValues: null });
        }
        surfaceRoot.updateMatrixWorld(true);
        const bounds = objects.map((object) => new THREE.Box3().setFromObject(object.mesh));
        const gap = 8;
        bounds.forEach((box, index) => {
          const width = box.max.x - box.min.x;
          const targetCenter = index === 0 ? -(gap / 2 + width / 2) : gap / 2 + width / 2;
          objects[index].mesh.position.x += targetCenter - (box.min.x + box.max.x) / 2;
        });
        surfaceRoot.updateMatrixWorld(true);
        const leftBox = new THREE.Box3().setFromObject(objects[0].mesh);
        const rightBox = new THREE.Box3().setFromObject(objects[1].mesh);
        if (rightBox.min.x - leftBox.max.x < 7.99) throw new Error("Cortical hemisphere separation could not be validated.");
        // Categorical roi_* nodes from the explainer never enter this scene.
        disposeTree(gltf.scene);
        gltf = null;
        runtime.ready = true;
        applyData(dataRef.current);
        applyMode(modeRef.current);
        setStatus("ready");
      } catch (cause) {
        if (gltf) disposeTree(gltf.scene);
        if (cancelled || cause?.name === "AbortError") return;
        runtime.ready = false;
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
      controls.dispose();
      objects.forEach((object) => object.proxy?.geometry.dispose());
      disposeTree(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      callbackRef.current?.(null);
    };
  }, [mapping]);

  useEffect(() => { runtimeRef.current?.applyView(view); }, [view]);
  useEffect(() => { runtimeRef.current?.applyMode(hemisphereMode); }, [hemisphereMode]);

  const changeView = (nextView) => {
    setView(nextView);
    viewRef.current = nextView;
    // Also reframe when resetting an already selected view.
    runtimeRef.current?.applyView(nextView);
  };

  return (
    <div className="upload-brain-viewer">
      <div ref={mountRef} className="upload-brain-canvas">
        {status !== "ready" && (
          <div className="upload-brain-status" role="status">
            {status === "error" ? error : "Loading Subject 1 cortical surface…"}
          </div>
        )}
      </div>
      <div className="upload-brain-view-controls" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label>
          View{" "}
          <select aria-label="Brain view" value={view} disabled={status !== "ready"} onChange={(event) => changeView(event.target.value)}>
            {Object.keys(VIEWS).map((name) => <option key={name} value={name}>{VIEW_LABELS[name]}</option>)}
          </select>
        </label>
        <button type="button" disabled={status !== "ready"} onClick={() => changeView(DEFAULT_VIEWS[roi?.label] || "overview")}>
          Reset view
        </button>
      </div>
    </div>
  );
}
