(function() {
  "use strict";

  /**
   * Apply .scrolled class to the body as the page is scrolled down
   */
  function toggleScrolled() {
    const selectBody = document.querySelector('body');
    const selectHeader = document.querySelector('#header');
    if (!selectHeader.classList.contains('scroll-up-sticky') && !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top')) return;
    window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
  }


  document.addEventListener('scroll', toggleScrolled);
  window.addEventListener('load', toggleScrolled);

  /**
   * Sync header height to CSS var --header-h
   */
  function syncHeaderHeightVar() {
    const header = document.querySelector('#header');
    const h = header ? header.offsetHeight : 0;
    document.documentElement.style.setProperty('--header-h', `${h}px`);
  }

  window.addEventListener('load', syncHeaderHeightVar);
  window.addEventListener('resize', syncHeaderHeightVar);

  
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('.mobile-nav-toggle')) {
      requestAnimationFrame(syncHeaderHeightVar);
    }
  });

  /**
   * Mobile nav toggle
   */
  const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');

  function mobileNavToogle() {
    document.querySelector('body').classList.toggle('mobile-nav-active');
    mobileNavToggleBtn.classList.toggle('bi-list');
    mobileNavToggleBtn.classList.toggle('bi-x');
  }
  if (mobileNavToggleBtn) {
    mobileNavToggleBtn.addEventListener('click', mobileNavToogle);
  }

  /**
   * Hide mobile nav on same-page/hash links
   */
  document.querySelectorAll('#navmenu a').forEach(navmenu => {
    navmenu.addEventListener('click', () => {
      if (document.querySelector('.mobile-nav-active')) {
        mobileNavToogle();
      }
    });

  });

  /**
   * Toggle mobile nav dropdowns
   */
  document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
    navmenu.addEventListener('click', function(e) {
      e.preventDefault();
      this.parentNode.classList.toggle('active');
      this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
      e.stopImmediatePropagation();
    });
  });

  /**
   * Scroll top button
   */
  let scrollTop = document.querySelector('.scroll-top');

  function toggleScrollTop() {
    if (scrollTop) {
      window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
    }
  }
  if (scrollTop) {
    scrollTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  window.addEventListener('load', toggleScrollTop);
  document.addEventListener('scroll', toggleScrollTop);

  /**
   * Animation on scroll function and init
   */
  function aosInit() {
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: true,
      mirror: false
    });
  }
  window.addEventListener('load', aosInit);

  /**
   * Initiate glightbox
   */
  const glightbox = GLightbox({
    selector: '.glightbox'
  });

  /**
   * Initiate Pure Counter
   */
  new PureCounter();

  /**
   * Frequently Asked Questions Toggle
   */
  document.querySelectorAll('.faq-item h3, .faq-item .faq-toggle').forEach((faqItem) => {
    faqItem.addEventListener('click', () => {
      faqItem.parentNode.classList.toggle('faq-active');
    });
  });

  /**
   * Init isotope layout and filters
   */
  document.querySelectorAll('.isotope-layout').forEach(function(isotopeItem) {
    let layout = isotopeItem.getAttribute('data-layout') ?? 'masonry';
    let filter = isotopeItem.getAttribute('data-default-filter') ?? '*';
    let sort = isotopeItem.getAttribute('data-sort') ?? 'original-order';

    let initIsotope;
    imagesLoaded(isotopeItem.querySelector('.isotope-container'), function() {
      initIsotope = new Isotope(isotopeItem.querySelector('.isotope-container'), {
        itemSelector: '.isotope-item',
        layoutMode: layout,
        filter: filter,
        sortBy: sort
      });
    });

    isotopeItem.querySelectorAll('.isotope-filters li').forEach(function(filters) {
      filters.addEventListener('click', function() {
        isotopeItem.querySelector('.isotope-filters .filter-active').classList.remove('filter-active');
        this.classList.add('filter-active');
        initIsotope.arrange({
          filter: this.getAttribute('data-filter')
        });
        if (typeof aosInit === 'function') {
          aosInit();
        }
      }, false);
    });

  });

  /**
   * Init swiper sliders
   */
  function initSwiper() {
    document.querySelectorAll(".init-swiper").forEach(function(swiperElement) {
      let config = JSON.parse(
        swiperElement.querySelector(".swiper-config").innerHTML.trim()
      );

      if (swiperElement.classList.contains("swiper-tab")) {
        initSwiperWithCustomPagination(swiperElement, config);
      } else {
        new Swiper(swiperElement, config);
      }
    });
  }

  window.addEventListener("load", initSwiper);

  /**
   * Correct scrolling position upon page load for URLs containing hash links.
   */
  window.addEventListener('load', function(e) {
    if (window.location.hash) {
      if (document.querySelector(window.location.hash)) {
        setTimeout(() => {
          let section = document.querySelector(window.location.hash);
          let scrollMarginTop = getComputedStyle(section).scrollMarginTop;
          window.scrollTo({
            top: section.offsetTop - parseInt(scrollMarginTop),
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  });

  /**
   * Navmenu Scrollspy
   */
  let navmenulinks = document.querySelectorAll('.navmenu a');

  /**
   * Set active nav link based on current URL path (for sub-pages without hash anchors)
   */
  function setNavActiveByPath() {
    const path = window.location.pathname;
    const labPaths    = ['/lab/', '/lab-whole-brain/', '/labLanding/'];
    const boardPaths  = ['/scoreboardLanding/', '/scoreboardQuantitative/', '/scoreboardQualitative/'];

    let targetHref = null;
    if (labPaths.some(p => path.startsWith(p))) {
      targetHref = '/labLanding/';
    } else if (boardPaths.some(p => path.startsWith(p))) {
      targetHref = '/scoreboardLanding/';
    }

    if (targetHref) {
      navmenulinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === targetHref) {
          link.classList.add('active');
        }
      });
    }
  }
  window.addEventListener('load', setNavActiveByPath);

  function navmenuScrollspy() {
    navmenulinks.forEach(navmenulink => {
      if (!navmenulink.hash) return;
      let section = document.querySelector(navmenulink.hash);
      if (!section) return;
      let position = window.scrollY + 200;
      if (position >= section.offsetTop && position <= (section.offsetTop + section.offsetHeight)) {
        document.querySelectorAll('.navmenu a.active').forEach(link => link.classList.remove('active'));
        navmenulink.classList.add('active');
      } else {
        navmenulink.classList.remove('active');
      }
    })
  }
  window.addEventListener('load', navmenuScrollspy);
  document.addEventListener('scroll', navmenuScrollspy);

  const MODEL_PAGE_DATASETS = [
    { key: 'bold_5000', label: 'BOLD5000' },
    { key: 'bonner_2021', label: 'Bonner2021' },
    { key: 'bmd_2024', label: 'BMD2024' },
    { key: 'kingbaker_2019', label: 'KingBaker2019' },
    { key: 'wardle_2020', label: 'Wardle2020' },
    { key: 'nsd_syn', label: 'NSD Synthetic' }
  ];

  const MODEL_PAGE_ROIS = [
    { key: 'ppa', label: 'PPA – Scene Processing', summaryLabel: 'PPA (Scene)' },
    { key: 'ffa', label: 'FFA – Face Processing', summaryLabel: 'FFA (Face)' },
    { key: 'eba', label: 'EBA – Body Processing', summaryLabel: 'EBA (Body)' }
  ];

  const MODEL_PAGE_SOURCES = {
    nsd: {
      buttonLabel: 'Trained on NSD',
      introLabel: 'NSD',
      dataPath: '/assets/data/new/standardized_results_nsd_1000_models_univariate.json?v=20260515-model-toggle'
    },
    murty: {
      buttonLabel: 'Trained on Murty',
      introLabel: 'Murty',
      dataPath: '/assets/data/new/standardized_results_murty185_models_univariate.json?v=20260515-model-toggle'
    }
  };

  let modelPageTransitionTimer = null;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function normalizeModelPageKey(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function getModelPageSlugFromPath(pathname) {
    const segments = pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    const modelPagesIndex = segments.lastIndexOf('model-pages');

    if (modelPagesIndex === -1 || modelPagesIndex >= segments.length - 1) {
      return null;
    }

    const slug = segments[modelPagesIndex + 1];
    return slug && slug.toLowerCase() !== 'index.html' ? slug : null;
  }

  function getModelPageDataKeys(data) {
    const keys = new Set();

    MODEL_PAGE_ROIS.forEach(({ key }) => {
      Object.keys(data?.[key] || {}).forEach((modelKey) => {
        keys.add(modelKey);
      });
    });

    return Array.from(keys);
  }

  function resolveModelPageModelKey(pageSlug, sourceData) {
    const allKeys = new Set();

    Object.values(sourceData).forEach((data) => {
      getModelPageDataKeys(data).forEach((key) => {
        allKeys.add(key);
      });
    });

    if (allKeys.has(pageSlug)) {
      return pageSlug;
    }

    const lowerSlug = pageSlug.toLowerCase();
    const caseInsensitiveMatch = Array.from(allKeys).find((key) => key.toLowerCase() === lowerSlug);
    if (caseInsensitiveMatch) {
      return caseInsensitiveMatch;
    }

    const normalizedLookup = new Map();
    Array.from(allKeys).forEach((key) => {
      const normalizedKey = normalizeModelPageKey(key);
      if (!normalizedLookup.has(normalizedKey)) {
        normalizedLookup.set(normalizedKey, key);
      }
    });

    return normalizedLookup.get(normalizeModelPageKey(pageSlug)) || null;
  }

  function getModelPagePrimaryValue(data, roiKey, modelKey, datasetKey) {
    const entry = data?.[roiKey]?.[modelKey]?.[datasetKey];
    if (!Array.isArray(entry) || entry.length === 0) {
      return null;
    }

    const value = Number(entry[0]);
    return Number.isFinite(value) ? value : null;
  }

  function averageModelPageValues(values) {
    if (!values.length) {
      return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function formatModelPageValue(value) {
    return Number.isFinite(value) ? value.toFixed(3) : 'N/A';
  }

  function buildModelPagePerformancePayload(data, modelKey) {
    const rows = MODEL_PAGE_DATASETS.map((dataset) => {
      const values = {};

      MODEL_PAGE_ROIS.forEach((roi) => {
        values[roi.key] = getModelPagePrimaryValue(data, roi.key, modelKey, dataset.key);
      });

      return {
        label: dataset.label,
        values
      };
    });

    const roiAverages = {};
    let globalValues = [];

    MODEL_PAGE_ROIS.forEach((roi) => {
      const values = rows
        .map((row) => row.values[roi.key])
        .filter((value) => Number.isFinite(value));

      if (!values.length) {
        return;
      }

      roiAverages[roi.key] = averageModelPageValues(values);
      globalValues = globalValues.concat(values);
    });

    if (!globalValues.length) {
      return null;
    }

    const strongestRoi = MODEL_PAGE_ROIS
      .map((roi) => ({ ...roi, value: roiAverages[roi.key] }))
      .filter((roi) => Number.isFinite(roi.value))
      .sort((left, right) => right.value - left.value)[0];

    return {
      global: averageModelPageValues(globalValues),
      rois: {
        ppa: roiAverages.ppa ?? null,
        ffa: roiAverages.ffa ?? null,
        eba: roiAverages.eba ?? null
      },
      rows,
      strongestRoi
    };
  }

  function buildMetricCardsMarkup(payload) {
    const cards = [
      { value: payload.global, label: 'Global Score (Pearson r)' },
      { value: payload.rois.ppa, label: 'PPA – Scene Processing' },
      { value: payload.rois.ffa, label: 'FFA – Face Processing' },
      { value: payload.rois.eba, label: 'EBA – Body Processing' }
    ];

    return cards.map((card, index) => `
      <div class="metric-card" style="--metric-index: ${index};">
        <div class="metric-value">${formatModelPageValue(card.value)}</div>
        <div class="metric-label">${card.label}</div>
      </div>
    `).join('');
  }

  function buildDatasetRowsMarkup(rows) {
    return rows.map((row, index) => `
      <tr style="--row-index: ${index};">
        <td>${row.label}</td>
        <td>${formatModelPageValue(row.values.ppa)}</td>
        <td>${formatModelPageValue(row.values.ffa)}</td>
        <td>${formatModelPageValue(row.values.eba)}</td>
      </tr>
    `).join('');
  }

  function getModelPageSourceSwitcherMarkup() {
    const buttonsMarkup = Object.entries(MODEL_PAGE_SOURCES).map(([sourceKey, source]) => `
      <button
        type="button"
        class="performance-source-button"
        data-source="${sourceKey}"
        aria-pressed="false"
      >${source.buttonLabel}</button>
    `).join('');

    return `
      <div class="performance-source-switcher" role="group" aria-label="Training source">
        ${buttonsMarkup}
      </div>
    `;
  }

  function getOrCreateModelPageSourceSwitcher(performanceCard, performanceHeading, onSelect) {
    let toolbar = performanceCard.querySelector('.performance-toolbar');

    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'performance-toolbar';
      toolbar.innerHTML = getModelPageSourceSwitcherMarkup();
      performanceHeading.insertAdjacentElement('afterend', toolbar);
    } else if (!toolbar.querySelector('.performance-source-switcher')) {
      toolbar.innerHTML = getModelPageSourceSwitcherMarkup();
    }

    toolbar.querySelectorAll('.performance-source-button').forEach((button) => {
      if (button.dataset.boundModelSourceToggle === 'true') {
        return;
      }

      button.dataset.boundModelSourceToggle = 'true';
      button.addEventListener('click', () => {
        onSelect(button.dataset.source);
      });
    });

    return toolbar;
  }

  function updateSwitcherButtons(toolbar, activeSource) {
    toolbar.querySelectorAll('.performance-source-button').forEach((button) => {
      const isActive = button.dataset.source === activeSource;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function triggerModelPagePerformanceTransition(performanceCard, datasetSection, aboutSummary) {
    const transitionTargets = [performanceCard, datasetSection, aboutSummary];

    transitionTargets.forEach((target) => {
      target.classList.remove('is-transitioning');
      void target.offsetWidth;
      target.classList.add('is-transitioning');
    });

    window.clearTimeout(modelPageTransitionTimer);
    modelPageTransitionTimer = window.setTimeout(() => {
      transitionTargets.forEach((target) => {
        target.classList.remove('is-transitioning');
      });
    }, 620);
  }

  function initModelPagePerformanceToggle() {
    const pageSlug = getModelPageSlugFromPath(window.location.pathname);
    const modelPage = document.querySelector('.model-page');

    if (!pageSlug || !modelPage) {
      return;
    }

    if (document.querySelector('script[src*="model-page-performance-toggle.js"]')) {
      return;
    }

    const performanceCard = Array.from(modelPage.querySelectorAll('.info-card')).find((card) => {
      return card.querySelector('h2')?.textContent.trim() === 'Performance Analysis';
    });

    const aboutSection = Array.from(modelPage.querySelectorAll('.context-section')).find((section) => {
      return section.querySelector('h2')?.textContent.trim() === 'About This Model';
    });

    const datasetSection = Array.from(modelPage.querySelectorAll('.context-section')).find((section) => {
      return section.querySelector('h2')?.textContent.trim() === 'Per-Dataset Breakdown (Pearson r)';
    });

    const performanceHeading = performanceCard?.querySelector('h2');
    const performanceIntro = performanceCard?.querySelector('p');
    const performanceGrid = performanceCard?.querySelector('.performance-grid');
    const datasetTable = datasetSection?.querySelector('table');
    const datasetTableBody = datasetTable?.querySelector('tbody');
    const modelTitle = modelPage.querySelector('.model-header h1')?.textContent.trim();
    const aboutParagraphs = aboutSection ? Array.from(aboutSection.querySelectorAll('p')) : [];
    const aboutSummary = aboutParagraphs.length > 1 ? aboutParagraphs[1] : null;

    if (!performanceCard || !performanceHeading || !performanceIntro || !performanceGrid || !datasetSection || !datasetTable || !datasetTableBody || !aboutSummary || !modelTitle) {
      return;
    }

    Promise.all(Object.entries(MODEL_PAGE_SOURCES).map(([sourceKey, source]) => {
      return fetch(source.dataPath)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load ${source.dataPath}`);
          }
          return response.json();
        })
        .then((data) => [sourceKey, data]);
    }))
      .then((entries) => {
        const sourceData = Object.fromEntries(entries);
        const resolvedModelKey = resolveModelPageModelKey(pageSlug, sourceData);

        if (!resolvedModelKey) {
          return;
        }

        const payloads = Object.keys(MODEL_PAGE_SOURCES).reduce((accumulator, sourceKey) => {
          const payload = buildModelPagePerformancePayload(sourceData[sourceKey], resolvedModelKey);
          if (payload) {
            accumulator[sourceKey] = payload;
          }
          return accumulator;
        }, {});

        if (!payloads.nsd || !payloads.murty) {
          return;
        }

        performanceCard.classList.add('performance-card-enhanced');
        performanceGrid.classList.add('performance-grid-enhanced');
        datasetSection.classList.add('performance-dataset-section');
        datasetTable.classList.add('performance-dataset-table');
        aboutSummary.classList.add('performance-summary-copy');

        const state = { activeSource: 'nsd' };
        const switcher = getOrCreateModelPageSourceSwitcher(performanceCard, performanceHeading, (nextSource) => {
          if (!payloads[nextSource] || state.activeSource === nextSource) {
            return;
          }

          state.activeSource = nextSource;
          updateSwitcherButtons(switcher, nextSource);
          renderModelPagePerformance(nextSource, true);
        });

        updateSwitcherButtons(switcher, state.activeSource);
        renderModelPagePerformance(state.activeSource, false);

        function renderModelPagePerformance(sourceKey, animate) {
          const payload = payloads[sourceKey];

          performanceIntro.innerHTML = `Pearson correlation between predicted and actual fMRI activity (trained on ${MODEL_PAGE_SOURCES[sourceKey].introLabel}, evaluated on held-out datasets). Scores above <strong>0.4</strong> are <strong>excellent</strong>; 0.01–0.02 differences are meaningful.`;
          performanceGrid.innerHTML = buildMetricCardsMarkup(payload);
          datasetTableBody.innerHTML = buildDatasetRowsMarkup(payload.rows);
          aboutSummary.innerHTML = `When evaluated against fMRI recordings from human participants, ${modelTitle} achieves a strong global Pearson correlation of <strong>${formatModelPageValue(payload.global)}</strong> (averaged across all evaluation datasets and brain regions). Its strongest predictions are in the <strong>${payload.strongestRoi.summaryLabel}</strong> area.`;

          if (animate && !prefersReducedMotion()) {
            triggerModelPagePerformanceTransition(performanceCard, datasetSection, aboutSummary);
          }
        }
      })
      .catch((error) => {
        console.warn('Model page performance toggle failed to initialize.', error);
      });
  }

  const TUTORIAL_STATE_KEY = 'cortexTutorialStateV2';
  const TUTORIALS = {
    labCategorySelective: {
      label: 'The Lab - Category-Selective Regions',
      description: 'Start on the Lab landing page, then move into the experiment builder.',
      steps: [
        {
          path: '/labLanding/',
          selector: '[data-tutorial="lab-category-selective-link"]',
          title: 'Choose a Lab Path',
          body: 'Start with Category-Selective Regions. Whole Brain stays visible here as a coming-soon path.',
          nextLabel: 'Enter The Lab',
          advanceOnTargetClick: true,
        },
        {
          path: '/lab/',
          selector: '[data-tutorial="lab-stepper-nav"]',
          title: 'Understand the Lab Flow',
          body: 'The Lab is organized as a stepper: upload stimuli, configure settings, then inspect prediction results.',
          nextLabel: 'Show Upload Step',
          prepare: { type: 'lab-step', value: 0 },
        },
        {
          path: '/lab/',
          selector: '[data-tutorial="lab-upload-panel"]',
          title: 'Upload Stimuli',
          body: 'Bring your own image set or load a preloaded dataset to start an experiment.',
          nextLabel: 'Show Settings',
          prepare: { type: 'lab-step', value: 0 },
        },
        {
          path: '/lab/',
          selector: '[data-tutorial="lab-settings-panel"]',
          title: 'Training Settings',
          body: 'Select the ROI, dataset, and model configuration before asking the Lab for predictions.',
          nextLabel: 'Show Results',
          prepare: { type: 'lab-step', value: 1 },
        },
        {
          path: '/lab/',
          selector: '[data-tutorial="lab-results-panel"]',
          title: 'Prediction Results',
          body: 'This section shows univariate responses, RDM structure, and optional cross-region insights after a run finishes.',
          nextLabel: 'Finish',
          prepare: { type: 'lab-step', value: 2 },
        },
      ],
    },
    scoreboardQuantitative: {
      label: 'The Scoreboard - Quantitative',
      description: 'Choose a quantitative entry point, then learn the comparison workspace.',
      steps: [
        {
          path: '/scoreboardLanding/',
          selector: '[data-tutorial="scoreboard-quantitative-links"]',
          title: 'Choose a Quantitative View',
          body: 'The quantitative flow starts here. Leaderboard is the fastest entry; Advanced Insight opens the comparison questions.',
          nextLabel: 'Open Leaderboard',
          advanceOnTargetClick: true,
        },
        {
          path: '/scoreboardQuantitative/',
          selector: '[data-tutorial="scoreboard-view-toggle"]',
          title: 'Switch Views',
          body: 'Toggle between Leaderboard and Advanced Insights without leaving the quantitative workspace.',
        },
        {
          path: '/scoreboardQuantitative/',
          selector: '[data-tutorial="scoreboard-filter-panel"]',
          title: 'Filter the Comparison',
          body: 'Use the left-side controls to narrow the scoreboard by training source, ROI, dataset, and model type.',
        },
        {
          path: '/scoreboardQuantitative/',
          selector: '[data-tutorial="scoreboard-chart-panel"]',
          title: 'Read the Charts',
          body: 'The main panel updates as filters change and shows the quantitative ranking or comparison view in detail.',
          nextLabel: 'Finish',
        },
      ],
    },
  };

  const tutorialUiState = {
    root: null,
    button: null,
    backdrop: null,
    launcher: null,
    card: null,
    progress: null,
    title: null,
    body: null,
    backButton: null,
    closeButton: null,
    nextButton: null,
    activeTutorialId: null,
    activeStepIndex: null,
    currentTarget: null,
    currentTargetHandler: null,
    launcherOpen: false,
    layoutListenersBound: false,
  };

  function normalizeTutorialPath(pathname) {
    if (!pathname || pathname === '/') return '/';

    const trimmed = pathname.replace(/index\.html$/i, '');
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }

  function getTutorialContextByPath(pathname) {
    const path = normalizeTutorialPath(pathname);

    if (path === '/labLanding/' || path === '/lab/') {
      return 'labCategorySelective';
    }

    if (path === '/scoreboardLanding/' || path === '/scoreboardQuantitative/') {
      return 'scoreboardQuantitative';
    }

    return null;
  }

  function getTutorialMatchIndex(tutorial, pathname) {
    const currentPath = normalizeTutorialPath(pathname);
    return tutorial.steps.findIndex((step) => normalizeTutorialPath(step.path) === currentPath);
  }

  function readTutorialState() {
    try {
      const raw = window.sessionStorage.getItem(TUTORIAL_STATE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeTutorialState(state) {
    try {
      window.sessionStorage.setItem(TUTORIAL_STATE_KEY, JSON.stringify(state));
    } catch {}
  }

  function getTutorialProgressLabel(tutorial, stepIndex) {
    const lastStepIndex = Math.max(0, tutorial.steps.length - 1);
    const displayStepIndex = Math.max(0, Math.min(stepIndex, lastStepIndex));
    return `${tutorial.label} • Step ${displayStepIndex} of ${lastStepIndex}`;
  }

  function clearTutorialState() {
    try {
      window.sessionStorage.removeItem(TUTORIAL_STATE_KEY);
    } catch {}
  }

  function injectTutorialStyles() {
    if (document.getElementById('cortex-tutorial-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'cortex-tutorial-styles';
    style.textContent = `
      #cortex-tutorial-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483647;
        isolation: isolate;
      }

      .cortex-tutorial-fab,
      .cortex-tutorial-backdrop,
      .cortex-tutorial-launcher,
      .cortex-tutorial-card {
        pointer-events: auto;
      }

      .cortex-tutorial-fab {
        position: fixed;
        left: auto;
        right: 24px;
        bottom: 24px;
        z-index: 2147483644;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        background: var(--tungsten, #4b443e);
        color: #fff;
        font: 600 14px/1.1 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
        box-shadow: 0 14px 32px rgba(34, 30, 26, 0.22);
      }

      .cortex-tutorial-fab:hover {
        background: var(--highlight-color-button, #7d6a58);
      }

      .cortex-tutorial-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483641;
        background: transparent;
        backdrop-filter: none;
      }

      .cortex-tutorial-launcher,
      .cortex-tutorial-card {
        position: fixed;
        z-index: 2147483646;
        background: #fff;
        border-radius: 22px;
        box-shadow: 0 28px 56px rgba(24, 20, 17, 0.24);
        border: 1px solid rgba(75, 68, 62, 0.12);
        font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
      }

      .cortex-tutorial-launcher {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(720px, calc(100vw - 32px));
        padding: 24px;
      }

      .cortex-tutorial-card {
        left: auto;
        right: 24px;
        bottom: 88px;
        width: min(420px, calc(100vw - 32px));
        padding: 20px 20px 18px;
      }

      .cortex-tutorial-is-hidden {
        display: none !important;
      }

      .cortex-tutorial-launcher-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 18px;
      }

      .cortex-tutorial-launcher-head h3,
      .cortex-tutorial-title {
        margin: 0;
        color: #241f1b;
        font-size: 1.15rem;
        font-weight: 700;
      }

      .cortex-tutorial-launcher-head p,
      .cortex-tutorial-body {
        margin: 8px 0 0;
        color: #5c524a;
        font-size: 0.95rem;
        line-height: 1.55;
      }

      .cortex-tutorial-current {
        margin-bottom: 18px;
        padding: 16px 18px;
        border-radius: 18px;
        background: #f7f2ee;
        border: 1px solid rgba(75, 68, 62, 0.1);
      }

      .cortex-tutorial-current-label {
        margin: 0 0 6px;
        font-size: 0.76rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #8a7768;
        font-weight: 700;
      }

      .cortex-tutorial-current strong {
        display: block;
        color: #241f1b;
        font-size: 1rem;
      }

      .cortex-tutorial-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }

      .cortex-tutorial-choice {
        padding: 16px;
        border-radius: 18px;
        border: 1px solid rgba(75, 68, 62, 0.12);
        background: #fcfaf8;
      }

      .cortex-tutorial-choice.is-current {
        background: #f6f0ea;
      }

      .cortex-tutorial-choice-label {
        margin: 0 0 8px;
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #8a7768;
        font-weight: 700;
      }

      .cortex-tutorial-choice h4 {
        margin: 0;
        color: #241f1b;
        font-size: 1rem;
        font-weight: 700;
      }

      .cortex-tutorial-choice p {
        margin: 8px 0 14px;
        color: #5c524a;
        font-size: 0.92rem;
        line-height: 1.5;
      }

      .cortex-tutorial-progress {
        margin-bottom: 10px;
        font-size: 0.78rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #8a7768;
        font-weight: 700;
      }

      .cortex-tutorial-actions,
      .cortex-tutorial-launcher-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        margin-top: 18px;
      }

      .cortex-tutorial-btn {
        border: 1px solid rgba(75, 68, 62, 0.18);
        background: #fff;
        color: #241f1b;
        border-radius: 999px;
        padding: 10px 14px;
        font: 600 14px/1 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
      }

      .cortex-tutorial-btn:hover {
        border-color: rgba(75, 68, 62, 0.34);
      }

      .cortex-tutorial-btn.is-primary {
        background: var(--tungsten, #4b443e);
        border-color: var(--tungsten, #4b443e);
        color: #fff;
      }

      .cortex-tutorial-btn.is-primary:hover {
        background: var(--highlight-color-button, #7d6a58);
        border-color: var(--highlight-color-button, #7d6a58);
      }

      .cortex-tutorial-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .cortex-tutorial-target {
        position: relative !important;
        z-index: 2147483645 !important;
        border-radius: 18px;
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.96), 0 0 0 9px rgba(134, 108, 83, 0.26);
      }

      @media (max-width: 720px) {
        .cortex-tutorial-launcher {
          width: calc(100vw - 20px);
          padding: 18px;
        }

        .cortex-tutorial-card {
          left: auto;
          right: 10px;
          bottom: 76px;
          width: min(420px, calc(100vw - 20px));
        }

        .cortex-tutorial-fab {
          left: auto;
          right: 12px;
          bottom: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isTutorialElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function getVisibleChatAnchor() {
    const chatbotContainer = document.getElementById('cortex-chatbot-container');
    if (isTutorialElementVisible(chatbotContainer)) {
      return chatbotContainer;
    }

    const chatbotToggle = document.getElementById('cortex-chatbot-toggle');
    if (isTutorialElementVisible(chatbotToggle)) {
      return chatbotToggle;
    }

    return null;
  }

  function positionTutorialButton() {
    if (!tutorialUiState.button) {
      return;
    }

    const sideOffset = window.innerWidth <= 720 ? 12 : 24;
    const defaultBottom = window.innerWidth <= 720 ? 12 : 24;
    let bottom = defaultBottom;

    const chatAnchor = getVisibleChatAnchor();
    if (chatAnchor) {
      const rect = chatAnchor.getBoundingClientRect();
      bottom = Math.max(defaultBottom, window.innerHeight - rect.top + 12);
    }

    tutorialUiState.button.style.left = 'auto';
    tutorialUiState.button.style.right = `${sideOffset}px`;
    tutorialUiState.button.style.bottom = `${Math.round(bottom)}px`;
  }

  function positionTutorialCard() {
    if (!tutorialUiState.card || tutorialUiState.card.classList.contains('cortex-tutorial-is-hidden')) {
      return;
    }

    const sideOffset = window.innerWidth <= 720 ? 10 : 24;
    const defaultBottom = window.innerWidth <= 720 ? 76 : 88;
    let bottom = defaultBottom;

    const buttonRect = tutorialUiState.button?.getBoundingClientRect();
    if (buttonRect) {
      bottom = Math.max(defaultBottom, window.innerHeight - buttonRect.top + 12);
    }

    tutorialUiState.card.style.left = 'auto';
    tutorialUiState.card.style.right = `${sideOffset}px`;
    tutorialUiState.card.style.bottom = `${Math.round(bottom)}px`;
  }

  function updateTutorialLayout() {
    positionTutorialButton();
    positionTutorialCard();
  }

  function ensureTutorialUi() {
    if (tutorialUiState.root) {
      return tutorialUiState;
    }

    injectTutorialStyles();

    const root = document.createElement('div');
    root.id = 'cortex-tutorial-root';
    root.innerHTML = `
      <button type="button" class="cortex-tutorial-fab" data-tutorial-ui="open">Tutorials</button>
      <div class="cortex-tutorial-backdrop cortex-tutorial-is-hidden" data-tutorial-ui="backdrop"></div>
      <div class="cortex-tutorial-launcher cortex-tutorial-is-hidden" data-tutorial-ui="launcher"></div>
      <div class="cortex-tutorial-card cortex-tutorial-is-hidden" data-tutorial-ui="card" role="dialog" aria-modal="true" aria-live="polite">
        <div class="cortex-tutorial-progress" data-tutorial-ui="progress"></div>
        <h3 class="cortex-tutorial-title" data-tutorial-ui="title"></h3>
        <p class="cortex-tutorial-body" data-tutorial-ui="body"></p>
        <div class="cortex-tutorial-actions">
          <button type="button" class="cortex-tutorial-btn" data-tutorial-ui="back">Back</button>
          <button type="button" class="cortex-tutorial-btn" data-tutorial-ui="close">Close</button>
          <button type="button" class="cortex-tutorial-btn is-primary" data-tutorial-ui="next">Next</button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    tutorialUiState.root = root;
    tutorialUiState.button = root.querySelector('[data-tutorial-ui="open"]');
    tutorialUiState.backdrop = root.querySelector('[data-tutorial-ui="backdrop"]');
    tutorialUiState.launcher = root.querySelector('[data-tutorial-ui="launcher"]');
    tutorialUiState.card = root.querySelector('[data-tutorial-ui="card"]');
    tutorialUiState.progress = root.querySelector('[data-tutorial-ui="progress"]');
    tutorialUiState.title = root.querySelector('[data-tutorial-ui="title"]');
    tutorialUiState.body = root.querySelector('[data-tutorial-ui="body"]');
    tutorialUiState.backButton = root.querySelector('[data-tutorial-ui="back"]');
    tutorialUiState.closeButton = root.querySelector('[data-tutorial-ui="close"]');
    tutorialUiState.nextButton = root.querySelector('[data-tutorial-ui="next"]');

    if (!tutorialUiState.layoutListenersBound) {
      tutorialUiState.layoutListenersBound = true;
      window.addEventListener('resize', updateTutorialLayout);
      window.setTimeout(updateTutorialLayout, 0);
      window.setTimeout(updateTutorialLayout, 300);
      window.setTimeout(updateTutorialLayout, 1000);
    }

    updateTutorialLayout();

    tutorialUiState.button.addEventListener('click', () => {
      updateTutorialLayout();
      const storedState = readTutorialState();
      if (storedState && TUTORIALS[storedState.tutorialId]) {
        showTutorialStep(storedState.tutorialId, storedState.stepIndex);
        return;
      }

      const currentTutorialId = getTutorialContextByPath(window.location.pathname);
      if (currentTutorialId) {
        startTutorial(currentTutorialId);
        return;
      }

      openTutorialLauncher();
    });
    tutorialUiState.backdrop.addEventListener('click', () => {
      if (tutorialUiState.launcherOpen) {
        closeTutorialLauncher();
      }
    });
    tutorialUiState.backButton.addEventListener('click', goToPreviousTutorialStep);
    tutorialUiState.closeButton.addEventListener('click', closeActiveTutorial);
    tutorialUiState.nextButton.addEventListener('click', goToNextTutorialStep);

    return tutorialUiState;
  }

  function hideTutorialElement(element) {
    if (element) {
      element.classList.add('cortex-tutorial-is-hidden');
    }
  }

  function showTutorialElement(element) {
    if (element) {
      element.classList.remove('cortex-tutorial-is-hidden');
    }
  }

  function clearTutorialTarget() {
    if (tutorialUiState.currentTarget && tutorialUiState.currentTargetHandler) {
      tutorialUiState.currentTarget.removeEventListener('click', tutorialUiState.currentTargetHandler, true);
    }

    if (tutorialUiState.currentTarget) {
      tutorialUiState.currentTarget.classList.remove('cortex-tutorial-target');
    }

    tutorialUiState.currentTarget = null;
    tutorialUiState.currentTargetHandler = null;
  }

  function maybeQueueTutorialAdvance(tutorialId, stepIndex) {
    const tutorial = TUTORIALS[tutorialId];
    if (!tutorial || stepIndex >= tutorial.steps.length) {
      return;
    }

    writeTutorialState({ tutorialId, stepIndex });
  }

  function applyTutorialTarget(step, tutorialId, stepIndex, target) {
    clearTutorialTarget();

    if (!target) {
      return;
    }

    tutorialUiState.currentTarget = target;
    target.classList.add('cortex-tutorial-target');
    target.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });

    if (step.advanceOnTargetClick) {
      tutorialUiState.currentTargetHandler = () => {
        maybeQueueTutorialAdvance(tutorialId, stepIndex + 1);
      };
      target.addEventListener('click', tutorialUiState.currentTargetHandler, true);
    }
  }

  function prepareTutorialStep(step) {
    if (!step || !step.prepare) {
      return;
    }

    if (step.prepare.type === 'lab-step') {
      const api = window.cortexLabTutorial;
      if (api && typeof api.setStep === 'function') {
        api.setStep(step.prepare.value);
      }
    }
  }

  function resolveTutorialTarget(step, tutorialId, stepIndex, attempt = 0) {
    if (tutorialUiState.activeTutorialId !== tutorialId || tutorialUiState.activeStepIndex !== stepIndex) {
      return;
    }

    prepareTutorialStep(step);

    const target = step.selector ? document.querySelector(step.selector) : null;
    if (target) {
      applyTutorialTarget(step, tutorialId, stepIndex, target);
      return;
    }

    if (attempt >= 24) {
      clearTutorialTarget();
      return;
    }

    window.setTimeout(() => {
      resolveTutorialTarget(step, tutorialId, stepIndex, attempt + 1);
    }, 180);
  }

  function openTutorialLauncher() {
    const ui = ensureTutorialUi();
    const currentTutorialId = getTutorialContextByPath(window.location.pathname);

    tutorialUiState.launcherOpen = true;
    clearTutorialTarget();
    hideTutorialElement(ui.card);
    showTutorialElement(ui.backdrop);
    showTutorialElement(ui.launcher);
    updateTutorialLayout();

    const cardsMarkup = Object.entries(TUTORIALS).map(([tutorialId, tutorial]) => {
      const isCurrent = tutorialId === currentTutorialId;
      return `
        <div class="cortex-tutorial-choice${isCurrent ? ' is-current' : ''}">
          <div class="cortex-tutorial-choice-label">${isCurrent ? 'Current section' : 'Tutorial'}</div>
          <h4>${tutorial.label}</h4>
          <p>${tutorial.description}</p>
          <button type="button" class="cortex-tutorial-btn is-primary" data-tutorial-id="${tutorialId}">
            ${isCurrent ? 'Start here' : 'Open tutorial'}
          </button>
        </div>
      `;
    }).join('');

    ui.launcher.innerHTML = `
      <div class="cortex-tutorial-launcher-head">
        <div>
          <h3>Tutorials</h3>
          <p>Choose a guided flow. When you are already inside a section, the matching tutorial is surfaced first.</p>
        </div>
        <div class="cortex-tutorial-launcher-actions">
          <button type="button" class="cortex-tutorial-btn" data-tutorial-ui="launcher-close">Close</button>
        </div>
      </div>
      ${currentTutorialId ? `
        <div class="cortex-tutorial-current">
          <div class="cortex-tutorial-current-label">Current section</div>
          <strong>${TUTORIALS[currentTutorialId].label}</strong>
          <p style="margin:8px 0 0;color:#5c524a;">Start from the first tutorial step available on this page, or switch to a different guided flow below.</p>
        </div>
      ` : ''}
      <div class="cortex-tutorial-grid">${cardsMarkup}</div>
    `;

    ui.launcher.querySelector('[data-tutorial-ui="launcher-close"]').addEventListener('click', closeTutorialLauncher);
    ui.launcher.querySelectorAll('[data-tutorial-id]').forEach((button) => {
      button.addEventListener('click', () => {
        startTutorial(button.getAttribute('data-tutorial-id'));
      });
    });
  }

  function closeTutorialLauncher() {
    const ui = ensureTutorialUi();
    tutorialUiState.launcherOpen = false;
    hideTutorialElement(ui.launcher);
    if (!tutorialUiState.activeTutorialId) {
      hideTutorialElement(ui.backdrop);
    }
  }

  function showTutorialStep(tutorialId, stepIndex) {
    const tutorial = TUTORIALS[tutorialId];
    if (!tutorial || stepIndex < 0 || stepIndex >= tutorial.steps.length) {
      closeActiveTutorial();
      return;
    }

    const step = tutorial.steps[stepIndex];
    const currentPath = normalizeTutorialPath(window.location.pathname);
    const stepPath = normalizeTutorialPath(step.path);

    if (currentPath !== stepPath) {
      writeTutorialState({ tutorialId, stepIndex });

      const destination =
        tutorialId === 'scoreboardQuantitative' && stepIndex === 1
          ? '/scoreboardQuantitative/?view=rank'
          : step.path;

      window.location.assign(destination);
      return;
    }

    const ui = ensureTutorialUi();
    tutorialUiState.activeTutorialId = tutorialId;
    tutorialUiState.activeStepIndex = stepIndex;
    tutorialUiState.launcherOpen = false;

    writeTutorialState({ tutorialId, stepIndex });

    hideTutorialElement(ui.launcher);
    showTutorialElement(ui.backdrop);
    showTutorialElement(ui.card);
    updateTutorialLayout();

    ui.progress.textContent = getTutorialProgressLabel(tutorial, stepIndex);
    ui.title.textContent = step.title;
    ui.body.textContent = step.body;
    ui.backButton.disabled = stepIndex === 0;
    ui.nextButton.textContent = step.nextLabel || (stepIndex === tutorial.steps.length - 1 ? 'Finish' : 'Next');

    resolveTutorialTarget(step, tutorialId, stepIndex);
  }

  function startTutorial(tutorialId) {
    const tutorial = TUTORIALS[tutorialId];
    if (!tutorial) {
      return;
    }

    const matchIndex = getTutorialMatchIndex(tutorial, window.location.pathname);
    const stepIndex = matchIndex >= 0 ? matchIndex : 0;
    showTutorialStep(tutorialId, stepIndex);
  }

  function goToNextTutorialStep() {
    const tutorial = TUTORIALS[tutorialUiState.activeTutorialId];
    if (!tutorial) {
      closeActiveTutorial();
      return;
    }

    const nextStepIndex = (tutorialUiState.activeStepIndex ?? 0) + 1;
    if (nextStepIndex >= tutorial.steps.length) {
      closeActiveTutorial();
      return;
    }

    showTutorialStep(tutorialUiState.activeTutorialId, nextStepIndex);
  }

  function goToPreviousTutorialStep() {
    const tutorialId = tutorialUiState.activeTutorialId;
    if (!tutorialId) {
      return;
    }

    const previousStepIndex = (tutorialUiState.activeStepIndex ?? 0) - 1;
    if (previousStepIndex < 0) {
      return;
    }

    showTutorialStep(tutorialId, previousStepIndex);
  }

  function closeActiveTutorial() {
    const ui = ensureTutorialUi();

    tutorialUiState.activeTutorialId = null;
    tutorialUiState.activeStepIndex = null;
    tutorialUiState.launcherOpen = false;

    clearTutorialTarget();
    clearTutorialState();
    hideTutorialElement(ui.launcher);
    hideTutorialElement(ui.card);
    hideTutorialElement(ui.backdrop);
    updateTutorialLayout();
  }

  function resumeTutorialIfNeeded() {
    const storedState = readTutorialState();
    if (!storedState || !TUTORIALS[storedState.tutorialId]) {
      return;
    }

    const tutorial = TUTORIALS[storedState.tutorialId];
    const stepIndex = Number.isInteger(storedState.stepIndex) ? storedState.stepIndex : 0;
    const storedStep = tutorial.steps[stepIndex];
    const currentPath = normalizeTutorialPath(window.location.pathname);

    if (storedStep && normalizeTutorialPath(storedStep.path) === currentPath) {
      showTutorialStep(storedState.tutorialId, stepIndex);
      return;
    }

    const fallbackIndex = getTutorialMatchIndex(tutorial, currentPath);
    if (fallbackIndex >= 0) {
      showTutorialStep(storedState.tutorialId, fallbackIndex);
    }
  }

  function initTutorialOverlay() {
    if (!document.body || document.body.dataset.cortexTutorialReady === 'true') {
      return;
    }

    document.body.dataset.cortexTutorialReady = 'true';
    ensureTutorialUi();
    resumeTutorialIfNeeded();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModelPagePerformanceToggle);
    document.addEventListener('DOMContentLoaded', initTutorialOverlay);
  } else {
    initModelPagePerformanceToggle();
    initTutorialOverlay();
  }

})();


var TxtType = function(el, toRotate, period) {
        this.toRotate = toRotate;
        this.el = el;
        this.loopNum = 0;
        this.period = parseInt(period, 10) || 2000;
        this.txt = '';
        this.tick();
        this.isDeleting = false;
    };

    TxtType.prototype.tick = function() {
        var i = this.loopNum % this.toRotate.length;
        var fullTxt = this.toRotate[i];

        if (this.isDeleting) {
        this.txt = fullTxt.substring(0, this.txt.length - 1);
        } else {
        this.txt = fullTxt.substring(0, this.txt.length + 1);
        }

        this.el.innerHTML = '<span class="wrap">'+this.txt+'</span>';

        var that = this;
        var delta = 80 - Math.random() * 50; // 200, 100

        if (this.isDeleting) { delta /= 2; }

        if (!this.isDeleting && this.txt === fullTxt) {
        delta = this.period;
        this.isDeleting = true;
        } else if (this.isDeleting && this.txt === '') {
        this.isDeleting = false;
        this.loopNum++;
        delta = 500;
        }

        setTimeout(function() {
        that.tick();
        }, delta);
    };

    window.onload = function() {
        var elements = document.getElementsByClassName('typewrite');
        for (var i=0; i<elements.length; i++) {
            var toRotate = elements[i].getAttribute('data-type');
            var period = elements[i].getAttribute('data-period');
            if (toRotate) {
              new TxtType(elements[i], JSON.parse(toRotate), period);
            }
        }
        // INJECT CSS
        var css = document.createElement("style");
        css.type = "text/css";
        css.innerHTML = ".typewrite > .wrap { border-right: 2px solid #4154f1; animation: blinking 0.8s infinite;}";
        document.body.appendChild(css);
    };

  