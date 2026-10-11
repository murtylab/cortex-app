(function () {
  "use strict";

  var STORAGE_KEY = "cortex-theme";

  function queryTheme() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.has("white") || params.get("theme") === "white" || params.get("bg") === "white") {
        return "white";
      }
      if (params.has("beige") || params.get("theme") === "beige" || params.get("bg") === "beige") {
        return "beige";
      }
    } catch (e) {}
    return null;
  }

  function storedTheme() {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function persist(theme) {
    try {
      sessionStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}
  }

  var fromQuery = queryTheme();
  var theme = fromQuery || storedTheme();
  if (fromQuery) persist(fromQuery);
  document.documentElement.classList.toggle("theme-white", theme === "white");
  if (theme === "white") {
    var style = document.createElement("style");
    style.textContent = "html.theme-white,html.theme-white body{background-color:#fff}";
    document.documentElement.appendChild(style);
  }
})();
