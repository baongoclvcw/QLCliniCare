// Xóa trạng thái lỗi khi người dùng bắt đầu nhập
["fullName","email","phone","gender","password","confirmPassword"].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener("input", () => clearError(id));
  el.addEventListener("change", () => clearError(id));
});

function showError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errEl = document.getElementById("err-" + fieldId);
  input.classList.add("is-error");
  errEl.textContent = message;
  errEl.classList.add("show");
}

function clearError(fieldId) {
  const input = document.getElementById(fieldId);
  const errEl = document.getElementById("err-" + fieldId);
  input.classList.remove("is-error");
  errEl.classList.remove("show");
}

function clearAllErrors() {
  ["fullName","email","phone","gender","password","confirmPassword"].forEach(clearError);
}

function showSuccessToast() {
  const toast = document.getElementById("successToast");
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function registerUser() {
  const fullName        = document.getElementById("fullName").value.trim();
  const email           = document.getElementById("email").value.trim();
  const phone           = document.getElementById("phone").value.trim();
  const gender          = document.getElementById("gender").value;
  const password        = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  clearAllErrors();
  let hasError = false;

  // Kiểm tra bắt buộc từng trường
  if (!fullName) {
    showError("fullName", "Vui lòng nhập đầy đủ thông tin.");
    hasError = true;
  }
  if (!email) {
    showError("email", "Vui lòng nhập đầy đủ thông tin.");
    hasError = true;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("email", "Email không đúng định dạng (ví dụ: name@example.com).");
    hasError = true;
  }

  // Số điện thoại: trống hoặc không hợp lệ
  if (!phone) {
    showError("phone", "Vui lòng nhập đầy đủ thông tin.");
    hasError = true;
  } else if (phone.replace(/\s/g, "").length !== 10) {
    showError("phone", "Số điện thoại phải đủ 10 chữ số.");
    hasError = true;
  }

  if (!gender) {
    showError("gender", "Vui lòng nhập đầy đủ thông tin.");
    hasError = true;
  }

  // Mật khẩu: trống hoặc quá ngắn
  if (!password) {
    showError("password", "Vui lòng nhập đầy đủ thông tin.");
    hasError = true;
  } else if (password.length < 6) {
    showError("password", "Mật khẩu phải có ít nhất 6 ký tự.");
    hasError = true;
  }

  // Xác nhận mật khẩu
  if (!confirmPassword) {
    showError("confirmPassword", "Vui lòng nhập đầy đủ thông tin.");
    hasError = true;
  } else if (password && confirmPassword !== password) {
    showError("confirmPassword", "Mật khẩu xác nhận không khớp.");
    hasError = true;
  }

  if (hasError) return;

  // Thành công
  showSuccessToast();

  console.log({ fullName, email, phone, gender, password });
}