/* Đặt lịch — dữ liệu khoa/bác sĩ/slot từ API */

let formData = null;
let deptList = [];
const doctorLabelMap = new Map();
let _bookingConfirmLock = false;

function mapGioiTinhToSelect(g) {
  if (!g) return "";
  const t = String(g).toLowerCase();
  if (t.includes("nữ") || t === "nu" || t === "female") return "female";
  if (t.includes("nam") || t === "male") return "male";
  return "other";
}

function formatNgaySinhToDDMM(ngay) {
  if (!ngay) return "";
  const s = String(ngay).split("T")[0].split(" ")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  return String(ngay);
}

function isoToDisplayDDMMYYYY(iso) {
  if (!iso) return "";
  const s = String(iso).split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso;
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function formatRoomBadgeLabel(tenPhong, maPhong) {
  const s = formatClinicRoomLabel(maPhong, tenPhong);
  return s || "Đang xếp phòng";
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function getDepartmentLabel(maKhoa) {
  const d = deptList.find(x => x.ma_khoa === maKhoa);
  return d ? d.ten_khoa : maKhoa || "";
}

function getDoctorName(maBacSi) {
  return doctorLabelMap.get(maBacSi) || "";
}

function genderSelectToProfile(g) {
  if (g === "male") return "Nam";
  if (g === "female") return "Nữ";
  if (g === "other") return "Khác";
  return "";
}

function dobDdMmYyyyToIso(s) {
  if (!s || typeof s !== "string") return null;
  const p = s.trim().split("/");
  if (p.length !== 3) return null;
  const d = parseInt(p[0], 10);
  const m = parseInt(p[1], 10);
  const y = parseInt(p[2], 10);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function fillDepartments() {
  const sel = document.getElementById("department");
  if (!sel) return;
  sel.innerHTML = '<option value="">Chọn khoa</option>';
  try {
    deptList = await Api.departments.getAll();
    deptList.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.ma_khoa;
      opt.textContent = d.ten_khoa;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
    sel.innerHTML = '<option value="">Lỗi tải khoa</option>';
  }
}

/** Bác sĩ đúng khoa, có ca làm việc ngày đó và còn ít nhất một khung giờ trống */
async function findFirstDoctorWithAvailableSlot(maKhoa, date) {
  const res = await Api.doctors.getAll({ ma_khoa: maKhoa });
  const items = res.items || [];
  for (const d of items) {
    try {
      const data = await Api.schedules.slots({ doctorId: d.ma_bac_si, date });
      const slots = data.slots || [];
      if (slots.some(s => s.available)) return d.ma_bac_si;
    } catch {
      /* không có lịch / lỗi mạng — thử bác sĩ khác */
    }
  }
  return null;
}

async function fillDoctorsForDepartment(maKhoa, preselectMaBs) {
  const doctorSelect = document.getElementById("doctor");
  doctorSelect.innerHTML = '<option value="">Chọn bác sĩ</option>';
  doctorLabelMap.clear();
  if (!maKhoa) {
    doctorSelect.disabled = true;
    return;
  }
  doctorSelect.disabled = true;
  try {
    const res = await Api.doctors.getAll({ ma_khoa: maKhoa });
    const items = res.items || [];
    items.forEach(d => {
      doctorLabelMap.set(d.ma_bac_si, d.ho_ten_bac_si);
      const opt = document.createElement("option");
      opt.value = d.ma_bac_si;
      opt.textContent = d.ho_ten_bac_si;
      doctorSelect.appendChild(opt);
    });
    doctorSelect.disabled = items.length === 0;
    if (preselectMaBs && items.some(x => x.ma_bac_si === preselectMaBs)) {
      doctorSelect.value = preselectMaBs;
    } else {
      const params = new URLSearchParams(location.search);
      const want = params.get("doctor");
      if (want && items.some(x => x.ma_bac_si === want)) {
        doctorSelect.value = want;
      }
    }
  } catch (err) {
    console.error(err);
    doctorSelect.disabled = true;
  }
}

document.getElementById("department").addEventListener("change", async function (e) {
  await fillDoctorsForDepartment(e.target.value);
  clearTimeGrid();
  checkConfirmDateBtn();
});

document.getElementById("doctor").addEventListener("change", () => {
  clearTimeGrid();
  checkConfirmDateBtn();
});

function clearTimeGrid() {
  const grid = document.getElementById("appointmentTimeGrid");
  if (grid) grid.innerHTML = "";
  document.getElementById("appointmentTime").value = "";
  const section = document.getElementById("timeSlotSection");
  if (section) section.style.display = "none";
  resetConfirmBtn();
}

function resetConfirmBtn() {
  const btn = document.getElementById("confirmDateBtn");
  if (!btn) return;
  btn.disabled = true;
  btn.classList.remove("confirmed");
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
    Xác nhận
  `;
}

function bindTimeSlotClicks() {
  document.querySelectorAll("#appointmentTimeGrid .time-slot:not(:disabled)").forEach(button => {
    button.addEventListener("click", function () {
      document.querySelectorAll("#appointmentTimeGrid .time-slot").forEach(btn => btn.classList.remove("selected"));
      this.classList.add("selected");
      document.getElementById("appointmentTime").value = this.dataset.time;
      const errEl = document.getElementById("apptTimeError");
      if (errEl) errEl.style.display = "none";
    });
  });
}

async function confirmDateSelection() {
  const maKhoa = document.getElementById("department").value;
  const date = document.getElementById("appointmentDate").value;
  let maBs = document.getElementById("doctor").value;

  if (!maKhoa) {
    alert("Vui lòng chọn khoa khám.");
    return;
  }
  if (!date) {
    alert("Vui lòng chọn ngày khám.");
    return;
  }

  if (!maBs) {
    const chosen = await findFirstDoctorWithAvailableSlot(maKhoa, date);
    if (!chosen) {
      alert(
        "Hiện không còn bác sĩ trống lịch trong ngày này, vui lòng chọn ngày khác hoặc chọn bác sĩ khác."
      );
      return;
    }
    await fillDoctorsForDepartment(maKhoa, chosen);
    maBs = document.getElementById("doctor").value;
  }

  const grid = document.getElementById("appointmentTimeGrid");
  const section = document.getElementById("timeSlotSection");
  if (!grid || !section) return;

  grid.innerHTML = '<p style="padding:8px;color:#64748b;">Đang tải khung giờ...</p>';
  section.style.display = "block";

  try {
    const data = await Api.schedules.slots({ doctorId: maBs, date });
    const slots = data.slots || [];
    if (!slots.length) {
      grid.innerHTML = '<p style="color:#b91c1c;">Không có khung giờ cho ngày này.</p>';
      return;
    }
    grid.innerHTML = slots
      .map(s => {
        const dis = s.available ? "" : " disabled";
        const cls = "time-slot" + (s.available ? "" : " slot-taken");
        return `<button type="button" class="${cls}" data-time="${s.time}"${dis}>${s.time}</button>`;
      })
      .join("");
    document.getElementById("appointmentTime").value = "";
    bindTimeSlotClicks();
  } catch (e) {
    grid.innerHTML = `<p style="color:#b91c1c;">${e.message || "Lỗi tải slot"}</p>`;
  }

  const btn = document.getElementById("confirmDateBtn");
  if (btn) {
    btn.classList.add("confirmed");
    btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
    </svg>
    Đã xác nhận`;
    btn.disabled = true;
  }
}

document.getElementById("appointmentForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const form = e.target;
  const data = new FormData(form);

  const phoneValue = data.get("phoneNumber") || "";
  const phoneInput = document.getElementById("phoneNumber");
  let phoneErrEl = document.getElementById("phoneError");
  if (!phoneErrEl) {
    phoneErrEl = document.createElement("div");
    phoneErrEl.id = "phoneError";
    phoneErrEl.style.cssText = "color:#EF4444;font-size:12px;margin-top:4px;display:none;";
    phoneInput.parentNode.insertBefore(phoneErrEl, phoneInput.nextSibling);
  }
  const phoneDigits = phoneValue.replace(/\D/g, "");
  if (phoneDigits.length !== 10) {
    phoneInput.style.borderColor = "#EF4444";
    phoneErrEl.textContent = "⚠ Số điện thoại phải đúng 10 chữ số";
    phoneErrEl.style.display = "block";
    phoneInput.focus();
    return;
  }
  phoneInput.style.borderColor = "";
  phoneErrEl.style.display = "none";

  const fullName = (data.get("fullName") || "").trim();
  if (fullName.length < 2) {
    alert("Vui lòng nhập họ và tên đầy đủ (ít nhất 2 ký tự).");
    const fn = document.getElementById("fullName");
    if (fn) fn.focus();
    return;
  }

  const genderVal = data.get("gender");
  if (!genderVal) {
    alert("Vui lòng chọn giới tính.");
    const gs = form.querySelector('[name="gender"]');
    if (gs) gs.focus();
    return;
  }

  const dobValue = data.get("dateOfBirth");
  const dobErr = validateDOB(dobValue);
  const dobInput = document.getElementById("dateOfBirth");
  let dobErrEl = document.getElementById("dobError");
  if (!dobErrEl) {
    dobErrEl = document.createElement("div");
    dobErrEl.id = "dobError";
    dobErrEl.style.cssText = "color:#EF4444;font-size:12px;margin-top:4px;display:none;";
    dobInput.parentNode.insertBefore(dobErrEl, dobInput.nextSibling);
  }
  if (dobErr) {
    dobInput.style.borderColor = "#EF4444";
    dobErrEl.textContent = "⚠ " + dobErr;
    dobErrEl.style.display = "block";
    dobInput.focus();
    return;
  }
  dobInput.style.borderColor = "";
  dobErrEl.style.display = "none";

  const doctorVal = data.get("doctor");
  if (!doctorVal) {
    alert("Vui lòng chọn bác sĩ.");
    document.getElementById("doctor").focus();
    return;
  }

  const apptDateValue = data.get("appointmentDate");
  const apptDateDisplay = document.getElementById("apptDateDisplay");
  let apptDateErrEl = document.getElementById("apptDateError");
  if (!apptDateErrEl) {
    apptDateErrEl = document.createElement("div");
    apptDateErrEl.id = "apptDateError";
    apptDateErrEl.style.cssText = "color:#EF4444;font-size:12px;margin-top:4px;display:none;";
    const apptDateHidden = document.getElementById("appointmentDate");
    apptDateHidden.parentNode.insertBefore(apptDateErrEl, apptDateHidden.nextSibling);
  }
  if (!apptDateValue) {
    apptDateDisplay.style.borderColor = "#EF4444";
    apptDateErrEl.textContent = "⚠ Vui lòng chọn ngày khám";
    apptDateErrEl.style.display = "block";
    apptDateDisplay.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  apptDateDisplay.style.borderColor = "";
  apptDateErrEl.style.display = "none";

  const apptTimeValue = data.get("appointmentTime");
  const timeSlotSection = document.getElementById("timeSlotSection");
  let apptTimeErrEl = document.getElementById("apptTimeError");
  if (!apptTimeErrEl) {
    apptTimeErrEl = document.createElement("div");
    apptTimeErrEl.id = "apptTimeError";
    apptTimeErrEl.style.cssText = "color:#EF4444;font-size:12px;margin-top:4px;display:none;";
    timeSlotSection.appendChild(apptTimeErrEl);
  }
  if (!apptTimeValue) {
    if (timeSlotSection.style.display === "none") {
      apptDateDisplay.style.borderColor = "#EF4444";
      apptDateErrEl.textContent = "⚠ Vui lòng xác nhận ngày khám để chọn giờ";
      apptDateErrEl.style.display = "block";
      apptDateDisplay.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      apptTimeErrEl.textContent = "⚠ Vui lòng chọn giờ khám còn trống";
      apptTimeErrEl.style.display = "block";
      timeSlotSection.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }
  apptTimeErrEl.style.display = "none";

  formData = {
    fullName,
    phoneNumber: data.get("phoneNumber"),
    gender: genderVal,
    dateOfBirth: data.get("dateOfBirth"),
    department: data.get("department"),
    doctor: data.get("doctor"),
    appointmentDate: data.get("appointmentDate"),
    appointmentTime: data.get("appointmentTime"),
    reasonForVisit: data.get("reasonForVisit")
  };

  showModal();
});

function showModal() {
  const departmentLabel = getDepartmentLabel(formData.department);
  const doctorName = getDoctorName(formData.doctor);

  const formatDate = dateStr => {
    if (!dateStr) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const summaryHtml = `
    <div class="summary-row">
      <span class="summary-label">Họ và tên:</span>
      <span class="summary-value">${formData.fullName}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Số điện thoại:</span>
      <span class="summary-value">${formData.phoneNumber}</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-row">
      <span class="summary-label">Khoa khám:</span>
      <span class="summary-value">${departmentLabel}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Bác sĩ:</span>
      <span class="summary-value">${doctorName}</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-row">
      <span class="summary-label">Ngày khám:</span>
      <span class="summary-value summary-highlight">${formatDate(formData.appointmentDate)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Giờ khám:</span>
      <span class="summary-value summary-highlight">${formData.appointmentTime}</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-full">
      <span class="summary-label">Ghi chú:</span>
      <span class="summary-value">${formData.reasonForVisit}</span>
    </div>
  `;

  document.getElementById("modalSummary").innerHTML = summaryHtml;
  document.getElementById("modalOverlay").classList.add("show");
  document.getElementById("modalContainer").classList.add("show");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("show");
  document.getElementById("modalContainer").classList.remove("show");
}

window._lastBookingId = null;

async function confirmAppointment() {
  if (_bookingConfirmLock) return;
  _bookingConfirmLock = true;
  const modalBtn = document.querySelector("#modalContainer .modal-actions .btn-primary");
  if (modalBtn) modalBtn.disabled = true;

  const u = getCurrentUser();
  const token = localStorage.getItem("accessToken");
  if (!u?.id || !token) {
    _bookingConfirmLock = false;
    if (modalBtn) modalBtn.disabled = false;
    alert("Vui lòng đăng nhập để đặt lịch.");
    window.location.href = "../dangnhap.html";
    return;
  }

  const hoTen = (formData.fullName || "").trim();
  if (hoTen.length < 2) {
    _bookingConfirmLock = false;
    if (modalBtn) modalBtn.disabled = false;
    alert("Thiếu họ tên hợp lệ. Vui lòng nhập lại form.");
    return;
  }

  const ngaySinhIso = dobDdMmYyyyToIso(formData.dateOfBirth);
  try {
    await Api.auth.updateProfile({
      ho_ten: hoTen,
      so_dien_thoai: String(formData.phoneNumber || "")
        .replace(/\D/g, "")
        .slice(0, 10),
      gioi_tinh: genderSelectToProfile(formData.gender),
      ...(ngaySinhIso ? { ngay_sinh: ngaySinhIso } : {})
    });
  } catch (e) {
    _bookingConfirmLock = false;
    if (modalBtn) modalBtn.disabled = false;
    alert(e.message || "Không cập nhật được hồ sơ bệnh nhân. Vui lòng thử lại.");
    return;
  }

  closeModal();

  const formatDate = dateStr => {
    if (!dateStr) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const departmentLabel = getDepartmentLabel(formData.department);
  const doctorName = getDoctorName(formData.doctor);

  let apptId = "";
  let roomBadge = "Đang xếp phòng";
  let createRes = null;
  try {
    createRes = await Api.bookings.create({
      ngay_kham: formData.appointmentDate,
      ma_bac_si: formData.doctor,
      ma_tai_khoan: u.id,
      gio_bat_dau_kham: formData.appointmentTime,
      mo_ta_trieu_chung: formData.reasonForVisit || ""
    });
    apptId = createRes.ma_lich_hen || "";
    window._lastBookingId = apptId;
    roomBadge = formatRoomBadgeLabel(createRes.ten_phong, createRes.ma_phong);
  } catch (e) {
    showToast(e.message || "Đặt lịch thất bại");
    return;
  } finally {
    _bookingConfirmLock = false;
    if (modalBtn) modalBtn.disabled = false;
  }

  const bookedDate =
    (typeof formatNgayGioVietNam === "function" && formatNgayGioVietNam(createRes && createRes.ngay_tao)) ||
    (typeof formatNgayGioLucNay === "function" ? formatNgayGioLucNay() : "");
  const svgIcon = path =>
    `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="${path}"/></svg>`;
  const iconDoc = svgIcon("M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z");
  const iconUser = svgIcon("M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z");
  const iconCal = svgIcon("M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z");
  const iconClock = svgIcon("M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z");
  const iconHosp = svgIcon("M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4");
  const iconPhone = svgIcon("M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z");
  const iconPerson = svgIcon("M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z");

  const detailItem = (icon, label, value) => `
    <div class="detail-item">
      ${icon}
      <div class="detail-item-content">
        <div class="detail-item-label">${label}</div>
        <div class="detail-item-value">${value}</div>
      </div>
    </div>`;

  document.getElementById("detailContent").innerHTML = `
    <div class="detail-header">
      <div>
        <h2>Thông tin lịch khám
          <span class="room-badge">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            ${roomBadge}
          </span>
        </h2>
        <span class="status-badge">Đã xác nhận</span>
      </div>
    </div>

    <div class="detail-grid">
      ${detailItem(iconDoc, "Mã lịch hẹn", apptId)}
      ${detailItem(iconUser, "Bác sĩ", doctorName)}
      ${detailItem(iconCal, "Ngày hẹn khám", formatDate(formData.appointmentDate))}
      ${detailItem(iconHosp, "Khoa", departmentLabel)}
      ${detailItem(iconClock, "Khung giờ khám", formData.appointmentTime)}
      ${detailItem(iconPhone, "Số điện thoại", formData.phoneNumber)}
      ${detailItem(iconCal, "Ngày đặt lịch", bookedDate)}
      ${detailItem(iconPerson, "Ngày sinh", formatDate(formData.dateOfBirth))}
    </div>

    <div class="detail-note">
      ${iconDoc}
      <div class="detail-note-content">
        <div class="detail-note-label">Ghi chú</div>
        <div class="detail-note-value">${formData.reasonForVisit}</div>
      </div>
    </div>

    <div class="detail-actions">
      <button class="btn btn-primary" onclick="editAppointment()">Chỉnh sửa</button>
      <button class="btn btn-danger" onclick="cancelAppointment()">Hủy lịch</button>
    </div>
  `;

  document.getElementById("formView").classList.add("hide");
  document.getElementById("detailView").classList.add("show");
  showToast("Đặt lịch hẹn thành công!");
}

function backToForm() {
  document.getElementById("detailView").classList.remove("show");
  document.getElementById("formView").classList.remove("hide");
}

async function editAppointment() {
  backToForm();
  let fd = formData;
  if (!fd && window._lastBookingId) {
    try {
      const d = await Api.bookings.getById(window._lastBookingId);
      const u = getCurrentUser();
      const ngay = String(d.ngay_kham || "").split("T")[0];
      fd = {
        fullName: d.benh_nhan || u?.fullName || "",
        phoneNumber: d.so_dien_thoai ? String(d.so_dien_thoai).replace(/\D/g, "").slice(0, 10) : "",
        gender: mapGioiTinhToSelect(d.gioi_tinh),
        dateOfBirth: formatNgaySinhToDDMM(d.ngay_sinh),
        department: d.ma_khoa,
        doctor: d.ma_bac_si,
        appointmentDate: ngay,
        appointmentTime: d.gio_bat_dau_kham || "",
        reasonForVisit: d.mo_ta_trieu_chung || ""
      };
      formData = fd;
    } catch (e) {
      console.warn(e);
    }
  }
  if (!fd) {
    showToast("Không có dữ liệu để chỉnh sửa. Vui lòng nhập lại.");
    return;
  }

  const form = document.getElementById("appointmentForm");
  form.fullName.value = fd.fullName || "";
  form.phoneNumber.value = (fd.phoneNumber || "").replace(/\D/g, "").slice(0, 10);
  form.gender.value = fd.gender || "";
  form.dateOfBirth.value = fd.dateOfBirth || "";
  form.reasonForVisit.value = fd.reasonForVisit || "";

  form.department.value = fd.department || "";
  await fillDoctorsForDepartment(fd.department, fd.doctor);
  const docSel = document.getElementById("doctor");
  if (fd.doctor && docSel) docSel.value = fd.doctor;

  const iso = String(fd.appointmentDate).split("T")[0];
  document.getElementById("appointmentDate").value = iso;
  const txt = document.getElementById("apptDateText");
  if (txt) {
    txt.textContent = isoToDisplayDDMMYYYY(iso);
    txt.style.color = "#374151";
  }

  resetConfirmBtn();
  const section = document.getElementById("timeSlotSection");
  if (section) section.style.display = "none";
  document.getElementById("appointmentTime").value = "";
  const grid = document.getElementById("appointmentTimeGrid");
  if (grid) grid.innerHTML = "";

  const cbtn = document.getElementById("confirmDateBtn");
  if (cbtn) {
    cbtn.classList.remove("confirmed");
    cbtn.disabled = false;
    cbtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
    Xác nhận`;
  }

  await confirmDateSelection();

  const t = fd.appointmentTime;
  if (t) {
    document.getElementById("appointmentTime").value = t;
    document.querySelectorAll("#appointmentTimeGrid .time-slot").forEach(btn => {
      btn.classList.toggle("selected", btn.dataset.time === t && !btn.disabled);
    });
  }

  showToast("Bạn có thể chỉnh sửa thông tin lịch hẹn");
}

async function cancelAppointment() {
  if (!confirm("Bạn có chắc chắn muốn hủy lịch hẹn này?")) return;
  if (window._lastBookingId) {
    try {
      await Api.bookings.cancel(window._lastBookingId);
      showToast("Đã hủy lịch hẹn thành công");
    } catch (e) {
      alert(e.message || "Không hủy được lịch");
      return;
    }
  }
  backToForm();
  resetForm();
}

function showToast(message) {
  document.getElementById("toastMessage").textContent = message;
  document.getElementById("toastContainer").classList.add("show");
  setTimeout(closeToast, 5000);
}

function closeToast() {
  document.getElementById("toastContainer").classList.remove("show");
}

function resetForm() {
  document.getElementById("appointmentForm").reset();
  document.querySelectorAll("#appointmentTimeGrid .time-slot").forEach(btn => btn.classList.remove("selected"));
  document.getElementById("doctor").disabled = true;
  formData = null;
  window._lastBookingId = null;
  const apptDateDisp = document.getElementById("apptDateDisplay");
  const apptDateErr = document.getElementById("apptDateError");
  const apptTimeErr = document.getElementById("apptTimeError");
  if (apptDateDisp) apptDateDisp.style.borderColor = "";
  if (apptDateErr) apptDateErr.style.display = "none";
  if (apptTimeErr) apptTimeErr.style.display = "none";
  clearTimeGrid();
}

(function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let calYear = today.getFullYear();
  let calMonth = today.getMonth();
  let selectedDate = null;

  const MONTHS_VI = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
  const DAYS_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function formatDDMMYYYY(d) {
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function renderCalendar() {
    const cal = document.getElementById("apptCalendar");
    if (!cal) return;
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    let html = `
      <div class="cal-header">
        <button type="button" id="calPrev">&#8249;</button>
        <span class="cal-month-year">${MONTHS_VI[calMonth]} ${calYear}</span>
        <button type="button" id="calNext">&#8250;</button>
      </div>
      <div class="cal-weekdays">${DAYS_VI.map(d => `<span>${d}</span>`).join("")}</div>
      <div class="cal-days">`;

    for (let i = 0; i < firstDay; i++) {
      html += `<button type="button" class="cal-day empty" disabled></button>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(calYear, calMonth, d);
      date.setHours(0, 0, 0, 0);
      const isPast = date < today;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isDisabled = isPast || isWeekend;
      const isToday = date.getTime() === today.getTime();
      const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
      let cls = "cal-day";
      if (isDisabled) cls += " disabled";
      if (isWeekend) cls += " weekend";
      if (isToday) cls += " today";
      if (isSelected) cls += " selected";
      html += `<button type="button" class="${cls}" ${isDisabled ? "disabled" : ""} data-ts="${date.getTime()}">${d}</button>`;
    }
    html += `</div>`;
    cal.innerHTML = html;

    document.getElementById("calPrev").addEventListener("click", function (e) {
      e.stopPropagation();
      calMonth--;
      if (calMonth < 0) {
        calMonth = 11;
        calYear--;
      }
      renderCalendar();
    });
    document.getElementById("calNext").addEventListener("click", function (e) {
      e.stopPropagation();
      calMonth++;
      if (calMonth > 11) {
        calMonth = 0;
        calYear++;
      }
      renderCalendar();
    });

    cal.querySelectorAll(".cal-day:not(.empty):not(.disabled)").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        selectedDate = new Date(parseInt(btn.dataset.ts));
        document.getElementById("appointmentDate").value = toISODate(selectedDate);
        const txt = document.getElementById("apptDateText");
        if (txt) {
          txt.textContent = formatDDMMYYYY(selectedDate);
          txt.style.color = "#374151";
        }
        cal.classList.remove("open");
        renderCalendar();
        const _dispEl = document.getElementById("apptDateDisplay");
        const _errEl = document.getElementById("apptDateError");
        if (_dispEl) _dispEl.style.borderColor = "";
        if (_errEl) _errEl.style.display = "none";
        clearTimeGrid();
        checkConfirmDateBtn();
      });
    });
  }

  window.toggleApptCalendar = function (e) {
    if (e) e.stopPropagation();
    const cal = document.getElementById("apptCalendar");
    if (!cal) return;
    if (cal.classList.contains("open")) {
      cal.classList.remove("open");
    } else {
      if (selectedDate) {
        calYear = selectedDate.getFullYear();
        calMonth = selectedDate.getMonth();
      } else {
        calYear = today.getFullYear();
        calMonth = today.getMonth();
      }
      cal.classList.add("open");
      renderCalendar();
    }
  };

  document.addEventListener("click", function (e) {
    const wrapper = document.getElementById("apptDateWrapper");
    if (wrapper && !wrapper.contains(e.target)) {
      const cal = document.getElementById("apptCalendar");
      if (cal) cal.classList.remove("open");
    }
  });

  const _origReset = window.resetForm;
  window.resetForm = function () {
    if (_origReset) _origReset();
    selectedDate = null;
    const txt = document.getElementById("apptDateText");
    if (txt) {
      txt.textContent = "Chọn ngày khám";
      txt.style.color = "#9CA3AF";
    }
    const hidden = document.getElementById("appointmentDate");
    if (hidden) hidden.value = "";
    const cal = document.getElementById("apptCalendar");
    if (cal) cal.classList.remove("open");
  };
})();

function validateDOB(value) {
  if (!value || value.length < 10) return "Vui lòng nhập ngày sinh (DD/MM/YYYY)";
  const parts = value.split("/");
  if (parts.length !== 3) return "Định dạng ngày sinh không hợp lệ (DD/MM/YYYY)";
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy) return "Vui lòng nhập ngày sinh hợp lệ";
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1900) return "Ngày sinh không hợp lệ";
  const dateObj = new Date(yyyy, mm - 1, dd);
  if (dateObj.getFullYear() !== yyyy || dateObj.getMonth() !== mm - 1 || dateObj.getDate() !== dd) return "Ngày không tồn tại, vui lòng kiểm tra lại";
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  if (dateObj >= t) return "Ngày sinh phải nhỏ hơn ngày hiện tại";
  return null;
}

(function () {
  const dobInput = document.getElementById("dateOfBirth");
  if (!dobInput) return;
  dobInput.addEventListener("input", function () {
    let raw = this.value.replace(/\D/g, "");
    let formatted = "";
    if (raw.length > 0) formatted = raw.substring(0, 2);
    if (raw.length > 2) formatted += "/" + raw.substring(2, 4);
    if (raw.length > 4) formatted += "/" + raw.substring(4, 8);
    this.value = formatted;
    const errEl = document.getElementById("dobError");
    if (errEl) errEl.style.display = "none";
    dobInput.style.borderColor = "";
  });
})();

(function () {
  const phoneInput = document.getElementById("phoneNumber");
  if (!phoneInput) return;
  phoneInput.addEventListener("keydown", function (e) {
    const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"];
    if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
  });
  phoneInput.addEventListener("paste", function (e) {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text");
    const digits = pasted.replace(/\D/g, "").substring(0, 10);
    this.value = digits;
    this.dispatchEvent(new Event("input"));
  });
  phoneInput.addEventListener("input", function () {
    const errEl = document.getElementById("phoneError");
    if (errEl) errEl.style.display = "none";
    phoneInput.style.borderColor = "";
    const clean = this.value.replace(/\D/g, "").substring(0, 10);
    if (this.value !== clean) this.value = clean;
  });
})();

function checkConfirmDateBtn() {
  const dept = document.getElementById("department").value;
  const date = document.getElementById("appointmentDate").value;
  const btn = document.getElementById("confirmDateBtn");
  if (!btn || btn.classList.contains("confirmed")) return;
  btn.disabled = !(dept && date);
}

function resetConfirmAndTimeSection() {
  const btn = document.getElementById("confirmDateBtn");
  const section = document.getElementById("timeSlotSection");
  if (btn && btn.classList.contains("confirmed")) {
    btn.classList.remove("confirmed");
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      Xác nhận`;
    if (section) section.style.display = "none";
    document.getElementById("appointmentTime").value = "";
    clearTimeGrid();
  }
}

document.getElementById("department").addEventListener("change", checkConfirmDateBtn);

(function () {
  const apptDateInput = document.getElementById("appointmentDate");
  let _lastDateVal = "";
  setInterval(function () {
    const cur = apptDateInput ? apptDateInput.value : "";
    if (cur !== _lastDateVal) {
      _lastDateVal = cur;
      checkConfirmDateBtn();
      resetConfirmAndTimeSection();
    }
  }, 200);
})();

const _origResetConfirm = window.resetForm;
window.resetForm = function () {
  if (_origResetConfirm) _origResetConfirm();
  const btn = document.getElementById("confirmDateBtn");
  const section = document.getElementById("timeSlotSection");
  if (btn) {
    btn.disabled = true;
    btn.classList.remove("confirmed");
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      Xác nhận`;
  }
  if (section) section.style.display = "none";
};

(async function bootstrap() {
  await fillDepartments();
  try {
    const u = getCurrentUser();
    if (u?.id && localStorage.getItem("accessToken")) {
      const p = await Api.auth.getProfile();
      const form = document.getElementById("appointmentForm");
      if (form && p) {
        if (p.ho_ten && !form.fullName.value) form.fullName.value = p.ho_ten;
        if (p.so_dien_thoai && !form.phoneNumber.value) {
          form.phoneNumber.value = String(p.so_dien_thoai).replace(/\D/g, "").slice(0, 10);
        }
        if (p.gioi_tinh && !form.gender.value) form.gender.value = mapGioiTinhToSelect(p.gioi_tinh);
        if (p.ngay_sinh && !form.dateOfBirth.value) form.dateOfBirth.value = formatNgaySinhToDDMM(p.ngay_sinh);
      }
    }
  } catch (e) {
    console.warn(e);
  }
  const params = new URLSearchParams(location.search);
  const preDoc = params.get("doctor");
  if (preDoc) {
    try {
      const info = await Api.doctors.getById(preDoc, { role: "patient" });
      const deptSel = document.getElementById("department");
      if (info.ma_khoa && deptSel) {
        deptSel.value = info.ma_khoa;
        deptSel.dispatchEvent(new Event("change"));
      }
    } catch (e) {
      console.warn(e);
    }
  }
})();
