document.addEventListener("DOMContentLoaded", function () {
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const rememberMeInput = document.getElementById("rememberMe");
  const loginButton = document.getElementById("loginBtn");

  const bannerError = document.getElementById("bannerError");
  const bannerErrorText = document.getElementById("bannerErrorText");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const successToast = document.getElementById("successToast");

  /* ── Helpers ── */
  function showBanner(msg) {
    bannerErrorText.textContent = msg;
    bannerError.classList.add("visible");
  }

  function hideBanner() {
    bannerError.classList.remove("visible");
  }

  function showFieldError(input, errorEl, msg) {
    input.classList.add("is-error");
    errorEl.textContent = msg;
    errorEl.classList.add("visible");
  }

  function clearFieldError(input, errorEl) {
    input.classList.remove("is-error");
    errorEl.textContent = "";
    errorEl.classList.remove("visible");
  }

  function clearAll() {
    hideBanner();
    clearFieldError(emailInput, emailError);
    clearFieldError(passwordInput, passwordError);
  }

  function showSuccessToast() {
    successToast.classList.add("show");
    setTimeout(() => {
      successToast.classList.remove("show");
    }, 3000);
  }

  /* Xóa lỗi ngay khi người dùng bắt đầu nhập lại */
  emailInput.addEventListener("input", function () {
    clearFieldError(emailInput, emailError);
    hideBanner();
  });

  passwordInput.addEventListener("input", function () {
    clearFieldError(passwordInput, passwordError);
    hideBanner();
  });

  /* ── Kiểm tra định dạng email cơ bản ── */
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /* ── Logic đăng nhập ── */
  async function loginUser() {
    clearAll();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    let hasError = false;

    if (!email && !password) {
      showBanner("Vui lòng nhập đầy đủ thông tin.");
      showFieldError(emailInput, emailError, "Email không được để trống.");
      showFieldError(passwordInput, passwordError, "Mật khẩu không được để trống.");
      emailInput.focus();
      return;
    }

    if (!email) {
      showFieldError(emailInput, emailError, "Vui lòng nhập đầy đủ thông tin.");
      emailInput.focus();
      hasError = true;
    } else if (!isValidEmail(email)) {
      showFieldError(emailInput, emailError, "Email không đúng định dạng (ví dụ: name@example.com).");
      emailInput.focus();
      hasError = true;
    }

    if (!password) {
      showFieldError(passwordInput, passwordError, "Vui lòng nhập đầy đủ thông tin.");
      if (!hasError) passwordInput.focus();
      hasError = true;
    }
     else if (password.length < 6) {
      showFieldError(passwordInput, passwordError, "Mật khẩu phải có ít nhất 6 ký tự.");
      if (!hasError) passwordInput.focus();
      hasError = true;
    }

    if (hasError) return;

    try {
      const result = await Api.auth.login({ email, password });
      saveLoginData(result);
      showSuccessToast();

      const role = result.user?.role || result.user?.roleName;

      setTimeout(() => {
        if (role === "VT01" || role === "Quản trị viên" || role === "admin") {
          window.location.href = "admin/trangchuadmin.html";
        } else {
          window.location.href = "benhnhan/trangchubn.html";
        }
      }, 800);
    } catch (error) {
      showBanner(error.message || "Đăng nhập thất bại, vui lòng thử lại.");
    }
  }

  loginButton.addEventListener("click", loginUser);

  passwordInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") loginUser();
  });

  emailInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") loginUser();
  });
});