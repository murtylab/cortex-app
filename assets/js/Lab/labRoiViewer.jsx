import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LAB_COLORS } from "./labTheme";

const MODEL_PATH = "/assets/brainModel/whole_brain_draco.glb";

function centerObject(object, targetSize) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  object.scale.multiplyScalar(targetSize / maxDim);

  const fitted = new THREE.Box3().setFromObject(object);
  const center = fitted.getCenter(new THREE.Vector3());
  object.position.sub(center);
}

export default function LabRoiViewer() {
  const mountRef = useRef(null);
  const interactingRef = useRef(false);
  const resumeTimerRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0.15, 0.08, 3.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 6.5;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.15;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(2.4, 1.8, 2.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8c4e0, 0.35);
    fill.position.set(-2.2, -0.4, -1.6);
    scene.add(fill);

    const brainGroup = new THREE.Group();
    scene.add(brainGroup);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(MODEL_PATH, (gltf) => {
      if (!mount.isConnected) return;
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xcfc8bc,
            roughness: 0.78,
            metalness: 0.02,
          });
        }
      });
      centerObject(model, 1.9);
      brainGroup.add(model);
    });

    const setSize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    setSize();

    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(mount);

    const pauseAutoRotate = () => {
      interactingRef.current = true;
      controls.autoRotate = false;
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    };
    const scheduleResume = () => {
      interactingRef.current = false;
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = window.setTimeout(() => {
        if (!interactingRef.current) controls.autoRotate = true;
      }, 1600);
    };

    controls.addEventListener("start", pauseAutoRotate);
    controls.addEventListener("end", scheduleResume);

    let frameId = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener("start", pauseAutoRotate);
      controls.removeEventListener("end", scheduleResume);
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      controls.dispose();
      renderer.dispose();
      dracoLoader.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className="lab-roi-viewer"
      style={{
        position: "relative",
        height: "100%",
        minHeight: 280,
        border: `0.5px solid ${LAB_COLORS.hairline}`,
        borderRadius: 8,
        background: LAB_COLORS.panel,
        overflow: "hidden",
      }}
    >
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div className="lab-roi-viewer-coming-soon">In development</div>
    </div>
  );
}
