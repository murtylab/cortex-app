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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModelPagePerformanceToggle);
  } else {
    initModelPagePerformanceToggle();
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

  