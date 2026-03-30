(function () {
  "use strict";

  const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "";
  const ANALYTICS_CONDITION = "regular";
  const STUDY_ID_STORAGE_KEY = "cortex_study_id";
  const SCROLL_THRESHOLDS = [25, 50, 75, 90];

  function isConfigured() {
    return typeof GA_MEASUREMENT_ID === "string" && GA_MEASUREMENT_ID.length > 0;
  }

  function getCurrentRoute() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  function getStudyId() {
    const existingStudyId = window.sessionStorage.getItem(STUDY_ID_STORAGE_KEY);
    if (existingStudyId) {
      return existingStudyId;
    }

    const generatedStudyId = `study_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(STUDY_ID_STORAGE_KEY, generatedStudyId);
    return generatedStudyId;
  }

  function cleanParams(params) {
    return Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
    );
  }

  function getGlobalParams() {
    return {
      route: getCurrentRoute(),
      study_id: getStudyId(),
      condition: ANALYTICS_CONDITION,
    };
  }

  function gtagReady() {
    return typeof window.gtag === "function";
  }

  function trackEvent(eventName, params = {}) {
    if (!gtagReady()) {
      return;
    }

    window.gtag("event", eventName, cleanParams({
      ...getGlobalParams(),
      ...params,
    }));
  }

  function trackPageView() {
    if (!gtagReady()) {
      return;
    }

    window.gtag("event", "page_view", cleanParams({
      ...getGlobalParams(),
      page_path: getCurrentRoute(),
      page_location: window.location.href,
      page_title: document.title,
    }));
  }

  function trackUiClick(component, ctaName, params = {}) {
    trackEvent("ui_click", {
      component,
      cta_name: ctaName,
      ...params,
    });
  }

  function setupScrollDepthTracking() {
    const hitThresholds = new Set();

    function onScroll() {
      const scrollTop = window.scrollY;
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollableHeight <= 0) {
        return;
      }

      const percentScrolled = Math.round((scrollTop / scrollableHeight) * 100);
      SCROLL_THRESHOLDS.forEach((threshold) => {
        if (percentScrolled >= threshold && !hitThresholds.has(threshold)) {
          hitThresholds.add(threshold);
          trackEvent("scroll_depth", { percent: threshold });
        }
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function setupSectionTracking() {
    const sectionCandidates = document.querySelectorAll("section[id], [data-analytics-section]");
    if (!sectionCandidates.length || typeof IntersectionObserver === "undefined") {
      return;
    }

    const seenSections = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const sectionId =
          entry.target.getAttribute("data-analytics-section") || entry.target.getAttribute("id");
        if (!sectionId || seenSections.has(sectionId)) {
          return;
        }

        seenSections.add(sectionId);
        trackEvent("view_section", { section_id: sectionId });
      });
    }, { threshold: 0.4 });

    sectionCandidates.forEach((candidate) => observer.observe(candidate));
  }

  function setupClickTracking() {
    document.addEventListener("click", (event) => {
      const target = event.target && event.target.closest
        ? event.target.closest("a, button, [role='button']")
        : null;

      if (!target) {
        return;
      }

      const component =
        target.closest("#navmenu") ? "navbar" :
        target.closest("#footer") ? "footer" :
        target.closest(".controls") ? "walkthrough_controls" :
        target.closest(".btn-group, .landing-left, .walkthrough-btn-row") ? "cta" :
        "page";

      const ctaName =
        target.getAttribute("data-analytics-name") ||
        target.textContent?.trim().replace(/\s+/g, "_").toLowerCase() ||
        target.getAttribute("href") ||
        target.tagName.toLowerCase();

      trackUiClick(component, ctaName, {
        href: target.getAttribute("href") || undefined,
      });
    });
  }

  function setupPageTimeTracking() {
    const pageStart = Date.now();

    window.addEventListener("pagehide", () => {
      trackEvent("page_time", {
        page_path: getCurrentRoute(),
        ms_total: Date.now() - pageStart,
      });
    });
  }

  function injectGoogleTag() {
    if (!isConfigured()) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
      window.dataLayer.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }

  function initAnalytics() {
    if (!isConfigured()) {
      return;
    }

    injectGoogleTag();
    trackPageView();
    setupPageTimeTracking();
    setupClickTracking();
    setupScrollDepthTracking();
    setupSectionTracking();
  }

  window.CortexAnalytics = {
    measurementId: GA_MEASUREMENT_ID,
    trackEvent,
    trackPageView,
    trackUiClick,
    getStudyId,
    condition: ANALYTICS_CONDITION,
  };

  initAnalytics();
})();
