(function () {
  function applyHeaderName() {
    let name = "";
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      name = u && u.fullName ? String(u.fullName) : "";
    } catch (_) {}
    if (!name) name = "Bệnh nhân";
    document.querySelectorAll(".header-username, .user-name").forEach(el => {
      el.textContent = name;
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyHeaderName);
  else applyHeaderName();
})();
