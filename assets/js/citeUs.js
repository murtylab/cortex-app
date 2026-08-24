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
    var done = function () {
      if (!btn) return;
      var original = btn.textContent;
      btn.textContent = "Copied";
      window.setTimeout(function () {
        btn.textContent = original;
      }, 1600);
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
        var scope = btn.closest(".cite-us-panel, .footer-cite-us") || document;
        var block = scope.querySelector("[data-cite-bibtex]");
        copyText((block && block.textContent) || BIBTEX, btn);
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

  function injectFooter() {
    var copyright = document.querySelector("#footer .copyright");
    if (!copyright || copyright.querySelector(".footer-cite-us")) return;

    var wrap = document.createElement("div");
    wrap.className = "footer-cite-us";
    wrap.innerHTML =
      '<div class="footer-cite-us-row">' +
      '<button type="button" class="cite-us-highlight" data-cite-toggle aria-expanded="false" aria-controls="footer-cite-bibtex">Cite us!</button>' +
      '<span class="footer-cite-us-line">Please cite Wang et al., CHI EA 2026, if you use this platform.</span>' +
      "</div>" +
      '<div id="footer-cite-bibtex" class="cite-us-panel" hidden>' +
      '<div class="cite-us-toolbar"><button type="button" class="cite-copy-btn" data-cite-copy>Copy</button></div>' +
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
    injectFooter();
    bindToggles(document);
    bindCopy(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
