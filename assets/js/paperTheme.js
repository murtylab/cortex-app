(function () {
  "use strict";

  var STORAGE_KEY = "cortex-theme";

  function queryTheme() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.has("white") || params.get("theme") === "white" || params.get("bg") === "white") {
        return "white";
      }
      if (params.has("dark") || params.get("theme") === "dark" || params.get("bg") === "dark") {
        return "dark";
      }
      if (params.has("beige") || params.get("theme") === "beige" || params.get("bg") === "beige") {
        return "beige";
      }
    } catch (e) {}
    return null;
  }

  function storedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function persist(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
      sessionStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}
  }

  function applyTheme(theme) {
    if (theme !== "dark" && theme !== "beige") theme = "white";
    var root = document.documentElement;
    root.classList.toggle("theme-white", theme === "white");
    root.classList.toggle("theme-dark", theme === "dark");
    root.style.backgroundColor = theme === "dark" ? "#0a0a0a" : "#ffffff";
    persist(theme);
    try {
      window.dispatchEvent(new CustomEvent("cortex-theme-change", { detail: { theme: theme } }));
    } catch (e) {}
  }

  var fromQuery = queryTheme();
  var theme = fromQuery === "dark" || fromQuery === "beige" ? fromQuery : "white";
  applyTheme(theme);

  if (theme === "dark") {
    var style = document.createElement("style");
    style.textContent = "html.theme-dark,html.theme-dark body{background-color:#0a0a0a}";
    document.documentElement.appendChild(style);
  } else if (theme === "white") {
    var whiteStyle = document.createElement("style");
    whiteStyle.textContent = "html.theme-white,html.theme-white body{background-color:#fff}";
    document.documentElement.appendChild(whiteStyle);
  }

  window.CortexTheme = {
    get: function () {
      return document.documentElement.classList.contains("theme-dark") ? "dark" : "white";
    },
    set: applyTheme,
    toggle: function () {
      applyTheme(window.CortexTheme.get() === "dark" ? "white" : "dark");
    }
  };
})();
