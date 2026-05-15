(function() {
  'use strict';

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

  const MODEL_PAGE_CACHE_BUSTER = '20260515-model-toggle-v2';

  const MODEL_PAGE_ANALYSES = {
    univariate: {
      buttonLabel: 'Univariate',
      introLabel: 'Univariate',
      summaryLabel: 'univariate',
      datasetLabel: 'Univariate',
      dataPaths: {
        nsd: `/assets/data/new/standardized_results_nsd_1000_models_univariate.json?v=${MODEL_PAGE_CACHE_BUSTER}`,
        murty: `/assets/data/new/standardized_results_murty185_models_univariate.json?v=${MODEL_PAGE_CACHE_BUSTER}`
      }
    },
    multivariate: {
      buttonLabel: 'Multivariate',
      introLabel: 'Multivariate',
      summaryLabel: 'multivariate',
      datasetLabel: 'Multivariate',
      dataPaths: {
        nsd: `/assets/data/new/standardized_results_nsd_1000_models_multivariate.json?v=${MODEL_PAGE_CACHE_BUSTER}`,
        murty: `/assets/data/new/standardized_results_murty185_models_multivariate.json?v=${MODEL_PAGE_CACHE_BUSTER}`
      }
    }
  };

  const MODEL_PAGE_SOURCES = {
    nsd: {
      buttonLabel: 'Trained on NSD',
      introLabel: 'NSD'
    },
    murty: {
      buttonLabel: 'Trained on Murty',
      introLabel: 'Murty'
    }
  };

  let modelPageTransitionTimer = null;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  function normalizeModelPageKey(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
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

  function resolveModelPageModelKey(pageSlug, dataVariants) {
    const allKeys = new Set();

    dataVariants.forEach((data) => {
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

  function buildDatasetComparisonHeaderMarkup() {
    const comparisonGroups = [
      { analysisKey: 'univariate', sourceKey: 'nsd', label: 'Uni · NSD' },
      { analysisKey: 'univariate', sourceKey: 'murty', label: 'Uni · Murty' },
      { analysisKey: 'multivariate', sourceKey: 'nsd', label: 'Multi · NSD' },
      { analysisKey: 'multivariate', sourceKey: 'murty', label: 'Multi · Murty' }
    ];

    const groupHeaders = comparisonGroups.map((group) => `
      <th colspan="3" data-analysis="${group.analysisKey}" data-source="${group.sourceKey}">${group.label}</th>
    `).join('');

    const roiHeaders = comparisonGroups.map(() => {
      return MODEL_PAGE_ROIS.map((roi) => `<th>${roi.summaryLabel}</th>`).join('');
    }).join('');

    return `
      <tr class="performance-dataset-header-group">
        <th rowspan="2">Dataset</th>
        ${groupHeaders}
      </tr>
      <tr class="performance-dataset-header-sub">
        ${roiHeaders}
      </tr>
    `;
  }

  function buildDatasetComparisonRowsMarkup(payloads) {
    const comparisonGroups = [
      { analysisKey: 'univariate', sourceKey: 'nsd' },
      { analysisKey: 'univariate', sourceKey: 'murty' },
      { analysisKey: 'multivariate', sourceKey: 'nsd' },
      { analysisKey: 'multivariate', sourceKey: 'murty' }
    ];

    return MODEL_PAGE_DATASETS.map((dataset, rowIndex) => {
      const cells = comparisonGroups.map(({ analysisKey, sourceKey }) => {
        const row = payloads[analysisKey]?.[sourceKey]?.rows?.[rowIndex];
        return MODEL_PAGE_ROIS.map((roi) => {
          return `<td>${formatModelPageValue(row?.values?.[roi.key] ?? null)}</td>`;
        }).join('');
      }).join('');

      return `
        <tr style="--row-index: ${rowIndex};">
          <td>${dataset.label}</td>
          ${cells}
        </tr>
      `;
    }).join('');
  }

  function getModelPageToolbarMarkup() {
    const analysisButtonsMarkup = Object.entries(MODEL_PAGE_ANALYSES).map(([analysisKey, analysis]) => `
      <button
        type="button"
        class="performance-toggle-button performance-analysis-button"
        data-analysis="${analysisKey}"
        aria-pressed="false"
      >${analysis.buttonLabel}</button>
    `).join('');

    const sourceButtonsMarkup = Object.entries(MODEL_PAGE_SOURCES).map(([sourceKey, source]) => `
      <button
        type="button"
        class="performance-toggle-button performance-source-button"
        data-source="${sourceKey}"
        aria-pressed="false"
      >${source.buttonLabel}</button>
    `).join('');

    return `
      <div class="performance-toggle-switcher performance-analysis-switcher" role="group" aria-label="Analysis type">
        ${analysisButtonsMarkup}
      </div>
      <div class="performance-toggle-switcher performance-source-switcher" role="group" aria-label="Training source">
        ${sourceButtonsMarkup}
      </div>
    `;
  }

  function getOrCreateModelPageToolbar(performanceCard, performanceHeading, onSelect) {
    let toolbar = performanceCard.querySelector('.performance-toolbar');

    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'performance-toolbar';
      performanceHeading.insertAdjacentElement('afterend', toolbar);
    }

    toolbar.innerHTML = getModelPageToolbarMarkup();

    toolbar.querySelectorAll('.performance-toggle-button').forEach((button) => {
      button.addEventListener('click', () => {
        onSelect({
          nextAnalysis: button.dataset.analysis || null,
          nextSource: button.dataset.source || null
        });
      });
    });

    return toolbar;
  }

  function updateToolbarButtons(toolbar, state) {
    toolbar.querySelectorAll('.performance-toggle-button').forEach((button) => {
      const isActive = button.dataset.analysis
        ? button.dataset.analysis === state.activeAnalysis
        : button.dataset.source === state.activeSource;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function triggerModelPagePerformanceTransition(...targets) {
    const transitionTargets = targets.filter(Boolean);

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

    if (!pageSlug || !modelPage || modelPage.dataset.performanceToggleStandaloneInitialized === 'true') {
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
    const datasetTableHead = datasetTable?.querySelector('thead');
    const datasetTableBody = datasetTable?.querySelector('tbody');
    const datasetIntro = datasetSection?.querySelector('p');
    const modelTitle = modelPage.querySelector('.model-header h1')?.textContent.trim();
    const aboutParagraphs = aboutSection ? Array.from(aboutSection.querySelectorAll('p')) : [];
    const aboutSummary = aboutParagraphs.length > 1 ? aboutParagraphs[1] : null;

    if (!performanceCard || !performanceHeading || !performanceIntro || !performanceGrid || !datasetSection || !datasetTable || !datasetTableHead || !datasetTableBody || !aboutSummary || !modelTitle) {
      return;
    }

    Promise.all(Object.entries(MODEL_PAGE_ANALYSES).flatMap(([analysisKey, analysis]) => {
      return Object.keys(MODEL_PAGE_SOURCES).map((sourceKey) => {
        return fetch(analysis.dataPaths[sourceKey])
        .then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to load ${analysis.dataPaths[sourceKey]}`);
            }
            return response.json();
          })
          .then((data) => [analysisKey, sourceKey, data]);
      });
    }))
      .then((entries) => {
        const analysisData = entries.reduce((accumulator, [analysisKey, sourceKey, data]) => {
          if (!accumulator[analysisKey]) {
            accumulator[analysisKey] = {};
          }

          accumulator[analysisKey][sourceKey] = data;
          return accumulator;
        }, {});
        const resolvedModelKey = resolveModelPageModelKey(pageSlug, entries.map(([, , data]) => data));

        if (!resolvedModelKey) {
          return;
        }

        const payloads = Object.keys(MODEL_PAGE_ANALYSES).reduce((accumulator, analysisKey) => {
          accumulator[analysisKey] = Object.keys(MODEL_PAGE_SOURCES).reduce((sourceAccumulator, sourceKey) => {
            const payload = buildModelPagePerformancePayload(analysisData[analysisKey]?.[sourceKey], resolvedModelKey);
            if (payload) {
              sourceAccumulator[sourceKey] = payload;
            }
            return sourceAccumulator;
          }, {});
          return accumulator;
        }, {});

        if (!payloads.univariate?.nsd || !payloads.univariate?.murty || !payloads.multivariate?.nsd || !payloads.multivariate?.murty) {
          return;
        }

        performanceCard.classList.add('performance-card-enhanced');
        performanceGrid.classList.add('performance-grid-enhanced');
        datasetSection.classList.add('performance-dataset-section');
        datasetTable.classList.add('performance-dataset-table');
        datasetTable.classList.add('performance-dataset-table-comparison');
        aboutSummary.classList.add('performance-summary-copy');
        datasetTableHead.innerHTML = buildDatasetComparisonHeaderMarkup();
        datasetTableBody.innerHTML = buildDatasetComparisonRowsMarkup(payloads);

        if (datasetIntro) {
          datasetIntro.innerHTML = 'Univariate and multivariate Pearson correlations across evaluation datasets and brain regions for models trained on NSD and Murty. These are hold-out datasets not used for model training.';
        }

        const state = {
          activeAnalysis: 'univariate',
          activeSource: 'nsd'
        };
        const toolbar = getOrCreateModelPageToolbar(performanceCard, performanceHeading, ({ nextAnalysis, nextSource }) => {
          const targetAnalysis = nextAnalysis || state.activeAnalysis;
          const targetSource = nextSource || state.activeSource;

          if (!payloads[targetAnalysis]?.[targetSource] || (state.activeAnalysis === targetAnalysis && state.activeSource === targetSource)) {
            return;
          }

          state.activeAnalysis = targetAnalysis;
          state.activeSource = targetSource;
          updateToolbarButtons(toolbar, state);
          renderModelPagePerformance(targetAnalysis, targetSource, true);
        });

        updateToolbarButtons(toolbar, state);
        renderModelPagePerformance(state.activeAnalysis, state.activeSource, false);
        modelPage.dataset.performanceToggleStandaloneInitialized = 'true';

        function renderModelPagePerformance(analysisKey, sourceKey, animate) {
          const payload = payloads[analysisKey][sourceKey];
          const analysis = MODEL_PAGE_ANALYSES[analysisKey];
          const source = MODEL_PAGE_SOURCES[sourceKey];

          performanceIntro.innerHTML = `${analysis.introLabel} Pearson correlation between predicted and actual fMRI activity (trained on ${source.introLabel}, evaluated on held-out datasets). Scores above <strong>0.4</strong> are <strong>excellent</strong>; 0.01–0.02 differences are meaningful.`;
          performanceGrid.innerHTML = buildMetricCardsMarkup(payload);
          aboutSummary.innerHTML = `When evaluated against fMRI recordings from human participants, ${modelTitle} achieves a strong global <strong>${analysis.summaryLabel}</strong> Pearson correlation of <strong>${formatModelPageValue(payload.global)}</strong> (averaged across all evaluation datasets and brain regions). Its strongest predictions are in the <strong>${payload.strongestRoi.summaryLabel}</strong> area.`;

          if (animate && !prefersReducedMotion()) {
            triggerModelPagePerformanceTransition(performanceCard, aboutSummary);
          }
        }
      })
      .catch((error) => {
        console.warn('Standalone model page performance toggle failed to initialize.', error);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModelPagePerformanceToggle);
  } else {
    initModelPagePerformanceToggle();
  }
})();