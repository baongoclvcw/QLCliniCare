function saveLoginData(data) {
  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("user", JSON.stringify(data.user));
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("user") || "null");
}

function getToken() {
  return localStorage.getItem("accessToken");
}

function clearAuth() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
}

function requireLogin() {
  if (!getToken()) {
    window.location.href = "../dangnhap.html";
  }
}

function requireAdmin() {
  const user = getCurrentUser();
  const isAdmin = user && (user.role === "VT01" || user.roleName === "Quản trị viên" || user.role === "admin");
  if (!getToken() || !user || !isAdmin) {
    alert("Bạn không có quyền truy cập");
    window.location.href = "../dangnhap.html";
  }
}

function requirePatient() {
  const user = getCurrentUser();
  const isPatient = user && (user.role === "VT02" || user.roleName === "Bệnh nhân" || user.role === "patient");
  if (!getToken() || !user || !isPatient) {
    alert("Bạn không có quyền truy cập");
    window.location.href = "../dangnhap.html";
  }
}

async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch (e) {
    console.warn(e.message);
  } finally {
    clearAuth();
    window.location.href = "../dangnhap.html";
  }
}