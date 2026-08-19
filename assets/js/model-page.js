(function () {
  'use strict';

  const CATALOG_PATH = '/assets/data/model-pages.json?v=20260819-model-page-v1';
  const SKIP_SLUGS = new Set(['index.html']);

  function getModelPageSlugFromPath(pathname) {
    const segments = pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    const modelPagesIndex = segments.lastIndexOf('model-pages');

    if (modelPagesIndex === -1) {
      return null;
    }

    const slug = segments[modelPagesIndex + 1];
    if (!slug || SKIP_SLUGS.has(slug.toLowerCase())) {
      return null;
    }

    return slug;
  }

  function normalizeKey(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function humanizeSlug(slug) {
    return slug
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveCatalogEntry(catalog, slug) {
    if (Object.prototype.hasOwnProperty.call(catalog, slug)) {
      return catalog[slug];
    }

    const lowerSlug = slug.toLowerCase();
    const caseMatch = Object.keys(catalog).find((key) => key.toLowerCase() === lowerSlug);
    if (caseMatch) {
      return catalog[caseMatch];
    }

    const normalizedSlug = normalizeKey(slug);
    const normalizedMatch = Object.keys(catalog).find((key) => normalizeKey(key) === normalizedSlug);
    return normalizedMatch ? catalog[normalizedMatch] : null;
  }

  function fallbackEntry(slug) {
    const name = humanizeSlug(slug);
    return {
      name,
      category: 'Model',
      info: { 'Model Name': name },
      about: [],
      docsUrl: '',
    };
  }

  function preferredInfoOrder(info) {
    const preferred = [
      'Model Name',
      'Category',
      'Architecture',
      'Parameters',
      'Training Data',
      'Pre-training',
    ];
    const seen = new Set();
    const ordered = [];

    preferred.forEach((label) => {
      if (info[label]) {
        ordered.push([label, info[label]]);
        seen.add(label);
      }
    });

    Object.entries(info).forEach(([label, value]) => {
      if (!seen.has(label) && value) {
        ordered.push([label, value]);
      }
    });

    return ordered;
  }

  function setStatus(message, isError) {
    const status = document.getElementById('model-page-status');
    if (!status) {
      return;
    }

    status.hidden = !message;
    status.textContent = message || '';
    status.classList.toggle('is-error', Boolean(isError));
  }

  function renderIndex(catalog) {
    const status = document.getElementById('model-page-status');
    const page = document.getElementById('model-page');
    if (!status || !page) {
      return;
    }

    document.title = 'Models - Virtual Visual Cortex';
    page.hidden = true;
    status.classList.remove('is-error');
    status.innerHTML = `
      <span class="model-page-index-title">Model pages</span>
      <span class="model-page-index-copy">Open a model from the Scoreboard, or choose one below.</span>
      <ul class="model-page-index-list">
        ${Object.entries(catalog)
          .sort(([, left], [, right]) => left.name.localeCompare(right.name))
          .map(([slug, model]) => `
            <li>
              <a href="/model-pages/${encodeURIComponent(slug)}/">${escapeHtml(model.name)}</a>
              <span>${escapeHtml(model.category || '')}</span>
            </li>
          `)
          .join('')}
      </ul>
    `;
  }

  function renderModel(slug, model) {
    const page = document.getElementById('model-page');
    const title = document.getElementById('model-page-title');
    const category = document.getElementById('model-page-category');
    const infoRoot = document.getElementById('model-page-info');
    const about = document.getElementById('model-page-about');
    const docs = document.getElementById('model-page-docs');

    if (!page || !title || !category || !infoRoot || !about || !docs) {
      return;
    }

    document.title = `${model.name} - Virtual Visual Cortex`;
    title.textContent = model.name;
    category.textContent = model.category || '';
    infoRoot.innerHTML = preferredInfoOrder(model.info || {})
      .map(([label, value]) => `
        <div class="info-item">
          <strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}
        </div>
      `)
      .join('');

    about.textContent = (model.about && model.about[0])
      || `${model.name} is included in the Cortex scoreboard. Detailed model-card notes are not available yet.`;

    if (model.docsUrl) {
      docs.href = model.docsUrl;
      docs.hidden = false;
    } else {
      docs.removeAttribute('href');
      docs.hidden = true;
    }

    page.hidden = false;
    page.dataset.modelSlug = slug;
    setStatus('');

    if (typeof window.initModelPagePerformanceToggle === 'function') {
      window.initModelPagePerformanceToggle();
    }
  }

  function initNeuralBackground() {
    const canvas = document.getElementById('neuralCanvas');
    if (!canvas || !canvas.getContext) {
      return;
    }

    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    const nodes = [];
    const nodeCount = 50;

    for (let i = 0; i < nodeCount; i += 1) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      });
    }

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < nodeCount; i += 1) {
        for (let j = i + 1; j < nodeCount; j += 1) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.strokeStyle = 'rgba(160, 122, 170, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < nodeCount; i += 1) {
        nodes[i].x += nodes[i].vx;
        nodes[i].y += nodes[i].vy;

        if (nodes[i].x < 0 || nodes[i].x > canvas.width) nodes[i].vx *= -1;
        if (nodes[i].y < 0 || nodes[i].y > canvas.height) nodes[i].vy *= -1;

        ctx.fillStyle = 'rgba(160, 122, 170, 0.2)';
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(tick);
    }

    tick();
  }

  async function initModelPage() {
    const slug = getModelPageSlugFromPath(window.location.pathname);

    try {
      const response = await fetch(CATALOG_PATH);
      if (!response.ok) {
        throw new Error(`Failed to load model catalog (${response.status})`);
      }

      const catalog = await response.json();
      if (!slug) {
        renderIndex(catalog);
        return;
      }

      renderModel(slug, resolveCatalogEntry(catalog, slug) || fallbackEntry(slug));
    } catch (error) {
      console.warn('Model page failed to initialize.', error);
      if (slug) {
        renderModel(slug, fallbackEntry(slug));
        return;
      }
      setStatus('Could not load model pages.', true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initNeuralBackground();
      initModelPage();
    });
  } else {
    initNeuralBackground();
    initModelPage();
  }
})();
