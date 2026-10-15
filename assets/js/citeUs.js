(function () {
  "use strict";

  var BIBTEX =
    "@inproceedings{10.1145/3772363.3798548,\n" +
    "author = {Wang, Ruolin and Li, Yuxuan and Deb, Mayukh and Reddy Dudipala, Kushal and Ravikanti, Kruthik and Chillarege, Sanjana and Bhanushali, Arya and Koushik, Ranjani and Katiyar, Aashraya and Ratan Murty, N Apurva},\n" +
    "title = {Cortex-Canvas: An Interactive Web Interface for Executing and Evaluating Models of Category-Selective Regions in Human Visual Cortex},\n" +
    "year = {2026},\n" +
    "isbn = {9798400722813},\n" +
    "publisher = {Association for Computing Machinery},\n" +
    "address = {New York, NY, USA},\n" +
    "url = {https://doi.org/10.1145/3772363.3798548},\n" +
    "doi = {10.1145/3772363.3798548},\n" +
    "booktitle = {Proceedings of the Extended Abstracts of the 2026 CHI Conference on Human Factors in Computing Systems},\n" +
    "articleno = {191},\n" +
    "numpages = {7},\n" +
    "keywords = {NeuroAI, Visual Cortex, Encoding Models, Data Visualization},\n" +
    "series = {CHI EA '26}\n" +
    "}";

  function copyText(text, btn) {
    var label = btn && btn.querySelector(".cite-copy-label");
    var done = function () {
      if (!btn) return;
      if (label) label.textContent = "Copied";
      else btn.textContent = "Copied";
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {});
      return;
    }

    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "absolute";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      done();
    } catch (e) {}
    document.body.removeChild(area);
  }

  function fillBibtexBlocks(root) {
    (root || document).querySelectorAll("[data-cite-bibtex]").forEach(function (el) {
      if (!el.textContent.trim()) {
        el.textContent = BIBTEX;
      }
    });
  }

  function bindCopy(root) {
    (root || document).querySelectorAll("[data-cite-copy]").forEach(function (btn) {
      if (btn.dataset.citeBound === "true") return;
      btn.dataset.citeBound = "true";
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var targetId = btn.getAttribute("data-cite-for");
        var block = null;
        if (targetId) {
          var panel = document.getElementById(targetId);
          block = panel && panel.querySelector("[data-cite-bibtex]");
        } else {
          var scope = btn.closest(".cite-us-panel, .footer-cite-us") || document;
          block = scope.querySelector("[data-cite-bibtex]");
        }
        copyText((block && block.textContent) || BIBTEX, btn);
        var panelId = btn.getAttribute("aria-controls");
        if (!panelId) return;
        var citePanel = document.getElementById(panelId);
        if (!citePanel) return;
        btn.setAttribute("aria-expanded", "true");
        citePanel.hidden = false;
      });
    });
  }

  function ensureCloseButtons(root) {
    (root || document).querySelectorAll(".cite-us-panel").forEach(function (panel) {
      if (panel.querySelector("[data-cite-close]")) return;
      var close = document.createElement("button");
      close.type = "button";
      close.className = "cite-close";
      close.setAttribute("data-cite-close", "");
      close.setAttribute("aria-label", "Close citation");
      close.textContent = "×";
      panel.insertBefore(close, panel.firstChild);
    });
  }

  function bindClose(root) {
    (root || document).querySelectorAll("[data-cite-close]").forEach(function (btn) {
      if (btn.dataset.citeBound === "true") return;
      btn.dataset.citeBound = "true";
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var panel = btn.closest(".cite-us-panel");
        if (!panel) return;
        panel.hidden = true;
        if (!panel.id) return;
        var opener = document.querySelector('[aria-controls="' + panel.id + '"]');
        if (opener) opener.setAttribute("aria-expanded", "false");
      });
    });
  }

  function bindToggles(root) {
    (root || document).querySelectorAll("[data-cite-toggle]").forEach(function (btn) {
      if (btn.dataset.citeBound === "true") return;
      btn.dataset.citeBound = "true";
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var panel = document.getElementById(btn.getAttribute("aria-controls"));
        if (!panel) return;
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        panel.hidden = open;
      });
    });
  }

  function injectSiteFooter() {
    var footer = document.getElementById("footer");
    if (!footer || footer.querySelector(".site-footer-nav")) return;

    var nav = document.createElement("nav");
    nav.className = "site-footer-nav";
    nav.setAttribute("aria-label", "Site");
    nav.innerHTML =
      '<div class="site-footer-mark">Cortex</div>' +
      "<hr>" +
      '<ul class="site-footer-menu">' +
      '<li><a href="/">Home</a></li>' +
      "<li>" +
      '<a href="/labLanding/">The Lab</a>' +
      "<ul>" +
      '<li><a href="/lab/">Functional Regions</a></li>' +
      '<li><a href="/lab-whole-brain/">Whole Brain</a></li>' +
      "</ul>" +
      "</li>" +
      "<li>" +
      '<a href="/scoreboardLanding/">The Scoreboard</a>' +
      "<ul>" +
      '<li><a href="/scoreboardQuantitative/">Quantitative</a></li>' +
      '<li><a href="/scoreboardQualitative/">Qualitative</a></li>' +
      "</ul>" +
      "</li>" +
      "</ul>";

    var copyright = footer.querySelector(".copyright");
    if (copyright) footer.insertBefore(nav, copyright);
    else footer.appendChild(nav);
  }

  function injectFooter() {
    var copyright = document.querySelector("#footer .copyright");
    if (!copyright || copyright.querySelector(".footer-cite-us")) return;

    var wrap = document.createElement("div");
    wrap.className = "footer-cite-us";
    wrap.innerHTML =
      '<div class="footer-cite-us-row">' +
      '<button type="button" class="cite-copy-btn" data-cite-copy data-cite-for="footer-cite-bibtex" aria-expanded="false" aria-controls="footer-cite-bibtex">' +
      '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M7.2 17.2c-1.9 0-3.3-1.5-3.3-3.5 0-2.7 2.2-5.3 5.4-6.8l.8 1.4c-1.9.9-3.1 2.3-3.5 3.8.4-.2.9-.3 1.4-.3 1.6 0 2.7 1.2 2.7 2.7s-1.2 2.7-3.5 2.7zm9.2 0c-1.9 0-3.3-1.5-3.3-3.5 0-2.7 2.2-5.3 5.4-6.8l.8 1.4c-1.9.9-3.1 2.3-3.5 3.8.4-.2.9-.3 1.4-.3 1.6 0 2.7 1.2 2.7 2.7s-1.2 2.7-3.5 2.7z"/></svg>' +
      '<span class="cite-copy-label">Copy BibTeX</span>' +
      "</button>" +
      '<span class="footer-cite-us-line">Please cite Wang et al., CHI EA 2026, if you use this platform.</span>' +
      "</div>" +
      '<div id="footer-cite-bibtex" class="cite-us-panel" hidden>' +
      '<pre class="cite-us-bibtex" data-cite-bibtex></pre>' +
      "</div>";

    var firstP = copyright.querySelector("p");
    if (firstP) {
      firstP.insertAdjacentElement("afterend", wrap);
    } else {
      copyright.insertBefore(wrap, copyright.firstChild);
    }

    fillBibtexBlocks(wrap);
    bindToggles(wrap);
    bindCopy(wrap);
  }

  function start() {
    fillBibtexBlocks(document);
    injectSiteFooter();
    injectFooter();
    ensureCloseButtons(document);
    bindToggles(document);
    bindCopy(document);
    bindClose(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
