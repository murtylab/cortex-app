// ===== Minimal 3D Brain STL Viewer =====
console.log('✅ index.js loaded');
import * as THREE from 'https://unpkg.com/three@0.159/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.159/examples/jsm/controls/OrbitControls.js?module';
import { STLLoader } from 'https://unpkg.com/three@0.159/examples/jsm/loaders/STLLoader.js?module';



function initBrainViewer(url = 'assets/brainModel/brain.stl') {
  const container = document.getElementById('brain-viewport');
  if (!container) return;

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 2000);
  camera.position.set(0, 0.2, 2.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.6;
  controls.enablePan = false;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xf3f5fb, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(1, 1, 1);
  scene.add(dir);

  const loader = new STLLoader();
  loader.load(
    url,
    (geometry) => {
    const material = new THREE.MeshPhysicalMaterial({
        // color: 0xf3f5fb,       // 浅蓝白
        metalness: 0.1,       // 几乎不带金属
        roughness: 0.1,       // 更光滑
        clearcoat: 0.5,        // 清漆层，增加光泽
        clearcoatRoughness: 0.1,
        reflectivity: 0.6,     // 让它多反射环境光
        transparent: true,   // 必须加
        opacity: 0.9

    });
    // 加入 y 方向渐变 (白 -> 浅蓝)
material.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <dithering_fragment>',
    `
      float grad = clamp((vViewPosition.y + 1.0) / 2.0, 0.0, 1.0);
      vec3 gradColor = mix(vec3(1.0,1.0,1.0), vec3(0.75,0.82,1.0), grad);
      gl_FragColor = vec4(gradColor, 1.0) * gl_FragColor;
      #include <dithering_fragment>
    `
  );
};
      const mesh = new THREE.Mesh(geometry, material);

        geometry.computeVertexNormals();  // 确保有法线
        geometry.center();

      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      mesh.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      mesh.scale.setScalar(1.2 / maxDim);
      mesh.rotation.x = -Math.PI /2;

      scene.add(mesh);

      let autoRotate = true;
      function tick(time) {
      requestAnimationFrame(tick);
      if (autoRotate) mesh.rotation.z += 0.001;

        // 变色逻辑：用时间算颜色
        const t = (Math.sin(time * 0.001) + 1) / 2; // 0~1 循环
        const r = 0.75;                // 红色高 → 偏白蓝
        const g = 0.9;                // 绿色高 → 去掉灰感
        const b = 0.85 + 0.3 * t; ;       // 蓝色 0.9 ~ 1.0 微变化
        mesh.material.color.setRGB(r, g, b);

        controls.update();
        renderer.render(scene, camera);
        }
        tick();

      controls.addEventListener('start', () => {
        autoRotate = false; // 拖动中关闭自转
        });

        controls.addEventListener('end', () => {
        autoRotate = true;  // 拖动结束恢复自转
        });
    },
    undefined,
    (err) => {
      console.error('STL 加载失败：', err);
      container.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:8px;background:#fff;border:1px solid rgba(132,32,41,0.35);color:#842029;font-size:14px;">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>' +
        '<span>模型加载失败，请检查路径和文件体积。</span></div>';
    }
  );

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  window.addEventListener('orientationchange', resize);
}

// ===== Neural Network Background Animation =====
function initNeuralNetwork() {
  const neuralCanvas = document.getElementById('neuralCanvas');
  if (!neuralCanvas) return;

  const ctx = neuralCanvas.getContext('2d');

  function resizeCanvas() {
    neuralCanvas.width = neuralCanvas.offsetWidth;
    neuralCanvas.height = neuralCanvas.offsetHeight;
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const nodes = [];
  const nodeCount = 40;

  // Create nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      x: Math.random() * neuralCanvas.width,
      y: Math.random() * neuralCanvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5
    });
  }

  function animateNetwork() {
    ctx.clearRect(0, 0, neuralCanvas.width, neuralCanvas.height);

    // Draw connections
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150) {
          ctx.strokeStyle = 'rgba(70, 85, 221, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes and update positions
    nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#4655dd';
      ctx.fill();

      // Update position
      node.x += node.vx;
      node.y += node.vy;

      // Bounce off edges
      if (node.x < 0 || node.x > neuralCanvas.width) node.vx *= -1;
      if (node.y < 0 || node.y > neuralCanvas.height) node.vy *= -1;
    });

    requestAnimationFrame(animateNetwork);
  }

  animateNetwork();
}

// Global neural background
function initGlobalNeuralBackground() {
  const canvas = document.getElementById('neuralCanvasGlobal');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const nodes = [];
  const nodeCount = 70; // a bit more nodes for full page

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4
    });
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 160) {
          ctx.strokeStyle = 'rgba(70, 85, 221, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#4655dd';
      ctx.fill();

      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
      if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
    });

    requestAnimationFrame(tick);
  }

  tick();
}

// Stats-only subtle background
function initStatsNeuralBackground() {
  const canvas = document.getElementById('neuralCanvasStats');
  const section = document.getElementById('stats');
  if (!canvas || !section) return;

  const ctx = canvas.getContext('2d');

  function resize() {
    // Match canvas to visible size of stats section
    const rect = section.getBoundingClientRect();
    canvas.width = section.clientWidth;
    canvas.height = section.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const nodes = [];
  const nodeCount = 30; // fewer nodes for less distraction

  function seedNodes() {
    nodes.length = 0;
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3
      });
    }
  }
  seedNodes();

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.strokeStyle = 'rgba(70, 85, 221, 0.18)'; // very light
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(70, 85, 221, 0.3)';
      ctx.fill();

      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
      if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
    });

    requestAnimationFrame(tick);
  }

  tick();
}

window.addEventListener('DOMContentLoaded', () => {
  initBrainViewer('assets/brainModel/brain.stl'); // <- 这里用你实际文件路径
  initNeuralNetwork();
  initGlobalNeuralBackground();
  initStatsNeuralBackground();
});