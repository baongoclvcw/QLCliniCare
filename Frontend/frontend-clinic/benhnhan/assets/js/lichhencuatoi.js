// =====================
// Data (từ API)
// =====================

let appointments = [];
let deptList = [];
const doctorLabelMap = new Map();

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function formatSqlDateVi(ngay) {
  if (!ngay) return "";
  const raw = String(ngay).trim();
  const s = raw.split("T")[0].split(" ")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  return raw;
}

function mapGenderDbToForm(g) {
  if (!g) return "";
  const t = String(g).toLowerCase();
  if (t.includes("nữ") || t === "nu" || t === "female") return "female";
  if (t.includes("nam") || t === "male") return "male";
  return "other";
}

function toIsoDate(ngay) {
  if (!ngay) return "";
  const s = String(ngay).split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

function mapBookingRow(row) {
  const u = getCurrentUser();
  const roomBadgeText = formatClinicRoomLabel(row.ma_phong, row.ten_phong) || "—";
  return {
    id: row.ma_lich_hen,
    bookingCode: row.ma_lich_hen,
    patientName: row.benh_nhan || u?.fullName || "Bạn",
    phoneNumber: row.so_dien_thoai ? String(row.so_dien_thoai).replace(/\D/g, "") : "",
    gender: mapGenderDbToForm(row.gioi_tinh),
    dateOfBirth: formatSqlDateVi(row.ngay_sinh),
    doctorName: row.ho_ten_bac_si || "",
    doctorId: row.ma_bac_si,
    department: row.ten_khoa || "",
    departmentValue: row.ma_khoa || "",
    date: formatSqlDateVi(row.ngay_kham),
    time: row.gio_bat_dau_kham || "",
    reasonForVisit: row.mo_ta_trieu_chung || "",
    createdDate:
      (typeof formatNgayGioVietNam === "function" && formatNgayGioVietNam(row.ngay_tao)) ||
      formatSqlDateVi(row.ngay_tao) ||
      "—",
    status: row.ten_trang_thai || "",
    ma_trang_thai: row.ma_trang_thai,
    roomDisplay: row.ma_phong || "—",
    roomBadgeText,
    raw: row
  };
}

async function loadDepartmentsForEdit() {
  const sel = document.getElementById("editDepartment");
  if (!sel) return;
  try {
    deptList = await Api.departments.getAll();
    const cur = sel.value;
    sel.innerHTML = '<option value="">Chọn khoa</option>';
    deptList.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.ma_khoa;
      opt.textContent = d.ten_khoa;
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  } catch (e) {
    console.error(e);
  }
}

async function loadMine() {
  const container = document.getElementById("appointmentsContainer");
  if (!getCurrentUser()?.id || !localStorage.getItem("accessToken")) {
    if (container) {
      container.innerHTML = `<div class="empty-state"><h3>Cần đăng nhập</h3><p><a href="../dangnhap.html">Đăng nhập</a> để xem lịch hẹn.</p></div>`;
    }
    return;
  }
  try {
    const res = await Api.bookings.getMine({ page: 1, pageSize: 50 });
    const seen = new Set();
    const items = (res.items || []).filter(row => {
      const id = row.ma_lich_hen;
      if (id == null || id === "") return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    appointments = items.map(mapBookingRow);
    renderAppointments();
  } catch (e) {
    if (container) {
      container.innerHTML = `<div class="empty-state"><h3>Không tải được dữ liệu</h3><p>${e.message}</p></div>`;
    }
  }
}

let currentAppointmentId = null;
let editingAppointmentId = null;


// =====================
// View Management
// =====================

function showView(viewId) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

function showListView() {
  showView('listView');
  currentAppointmentId = null;
  editingAppointmentId = null;
  renderAppointments();
}

function showDetailView(id) {
  currentAppointmentId = id;
  showView('detailView');
  renderDetail();
}

async function showEditView(id) {
  editingAppointmentId = id;
  showView("editView");
  await loadDepartmentsForEdit();
  await prefillEditForm();
}


// =====================
// Render Appointments List
// =====================

function renderAppointments() {
  const container = document.getElementById('appointmentsContainer');
  if (appointments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <h3>Chưa có lịch hẹn</h3>
        <p>Bạn chưa có lịch khám nào. Hãy đặt lịch khám mới.</p>
      </div>`;
    return;
  }
  container.innerHTML = appointments.map(apt => {
    const roomLine = apt.roomBadgeText || apt.roomDisplay || "—";
    return `
    <div class="appointment-card" onclick="showDetailView('${apt.id}')">
      <div class="appointment-info">
        <div class="appointment-doctor">${apt.doctorName || 'Chưa chọn'}</div>
        <div class="appointment-department">${apt.department}</div>
        <div class="appointment-details">
          <div class="appointment-detail-row">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            <span><span class="label">Bệnh nhân:</span> ${apt.patientName}</span>
          </div>
          <div class="appointment-detail-row">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <span><span class="label">Ngày khám:</span> ${apt.date}</span>
          </div>
          <div class="appointment-detail-row">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span><span class="label">Giờ khám:</span> ${apt.time}</span>
          </div>
          <div class="appointment-detail-row">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            <span><span class="label">Phòng khám:</span> ${roomLine}</span>
          </div>
        </div>
      </div>

    </div>`;
  }).join('');
}


// =====================
// Render Detail View
// =====================

function renderDetail() {
  const apt = appointments.find(a => a.id === currentAppointmentId);
  if (!apt) return;
  const container = document.getElementById('detailContent');
  const roomLabel = apt.roomBadgeText || "—";
  container.innerHTML = `
    <div class="detail-header">
      <div>
        <h2>Thông tin lịch khám
          <span class="room-badge">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            ${roomLabel}
          </span>
        </h2>
        <span class="status-badge">${apt.status}</span>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-item">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <div class="detail-item-content">
          <div class="detail-item-label">Mã lịch hẹn</div>
          <div class="detail-item-value">${apt.bookingCode}</div>
        </div>
      </div>
      <div class="detail-item">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <div class="detail-item-content">
          <div class="detail-item-label">Bác sĩ</div>
          <div class="detail-item-value">${apt.doctorName || 'Chưa chọn'}</div>
        </div>
      </div>
      <div class="detail-item">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <div class="detail-item-content">
          <div class="detail-item-label">Ngày hẹn khám</div>
          <div class="detail-item-value">${apt.date}</div>
        </div>
      </div>
      <div class="detail-item">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
        <div class="detail-item-content">
          <div class="detail-item-label">Khoa</div>
          <div class="detail-item-value">${apt.department}</div>
        </div>
      </div>
      <div class="detail-item">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <div class="detail-item-content">
          <div class="detail-item-label">Khung giờ khám</div>
          <div class="detail-item-value">${apt.time}</div>
        </div>
      </div>
      <div class="detail-item">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
        <div class="detail-item-content">
          <div class="detail-item-label">Số điện thoại</div>
          <div class="detail-item-value">${apt.phoneNumber}</div>
        </div>
      </div>
      <div class="detail-item">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <div class="detail-item-content">
          <div class="detail-item-label">Ngày đặt lịch</div>
          <div class="detail-item-value">${apt.createdDate}</div>
        </div>
      </div>
      <div class="detail-item">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        <div class="detail-item-content">
          <div class="detail-item-label">Ngày sinh</div>
          <div class="detail-item-value">${formatDateForDisplay(apt.dateOfBirth)}</div>
        </div>
      </div>
    </div>
    <div class="detail-note">
      <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      <div class="detail-note-content">
        <div class="detail-note-label">Ghi chú</div>
        <div class="detail-note-value">${apt.reasonForVisit || 'Không có ghi chú'}</div>
      </div>
    </div>
    <div class="detail-actions">
      <button class="btn btn-primary" onclick="showEditView('${apt.id}')">Chỉnh sửa</button>
      <button class="btn btn-danger" onclick="deleteAppointment('${apt.id}')">Hủy lịch</button>
    </div>`;
}


// =====================
// Delete Appointment
// =====================

async function deleteAppointment(id) {
  if (!confirm("Bạn có chắc chắn muốn hủy lịch hẹn này?")) return;
  try {
    await Api.bookings.cancel(id);
    appointments = appointments.filter(a => a.id !== id);
    currentAppointmentId = null;
    showToast("Đã hủy lịch hẹn thành công!");
    await loadMine();
    showListView();
  } catch (e) {
    alert(e.message || "Không hủy được lịch");
  }
}


// =====================
// Edit Form
// =====================

async function prefillEditForm() {
  const apt = appointments.find(a => a.id === editingAppointmentId);
  if (!apt) return;

  const form = document.getElementById('editForm');
  form.fullName.value     = apt.patientName;
  form.phoneNumber.value  = apt.phoneNumber;
  form.gender.value       = apt.gender;
  form.reasonForVisit.value = apt.reasonForVisit;

  const dob = apt.dateOfBirth || '';
  if (dob.includes('-')) {
    const [dy, dm, dd] = dob.split('-');
    form.dateOfBirth.value = `${dd}/${dm}/${dy}`;
  } else {
    form.dateOfBirth.value = dob;
  }

  form.department.value = apt.departmentValue || '';
  await updateDoctorList('editDepartment', 'editDoctor');
  if (apt.doctorId) {
    document.getElementById('editDoctor').value = apt.doctorId;
  }

  // Custom calendar: set display text and hidden value
  const isoFromApi = toIsoDate(apt.raw?.ngay_kham) || (() => {
    const parts = (apt.date || '').split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    return '';
  })();
  document.getElementById('editAppointmentDate').value = isoFromApi;
  const txt = document.getElementById('editDateText');
  if (txt) { txt.textContent = apt.date; txt.style.color = '#374151'; }
  window._editCalInitDate = isoFromApi;

  // Show time slots with confirmed state (prefilled = already valid selection)
  const section    = document.getElementById('editTimeSlotSection');
  const confirmBtn = document.getElementById('editConfirmDateBtn');
  if (section)    section.style.display = 'block';
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.classList.add('confirmed');
    confirmBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Đã xác nhận';
  }

  // Select the correct time slot
  document.querySelectorAll('#editTimeGrid .time-slot').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.time === apt.time);
  });
  document.getElementById('editAppointmentTime').value = apt.time;
}

document.getElementById('editForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);

  if (!appointments.find(a => a.id === editingAppointmentId)) return;

  const phoneValue   = data.get('phoneNumber') || '';
  const phoneInputEl = document.querySelector('#editForm input[name="phoneNumber"]');
  let   phoneErrEl   = document.getElementById('editPhoneError');
  if (!phoneErrEl) {
    phoneErrEl = document.createElement('div');
    phoneErrEl.id = 'editPhoneError';
    phoneErrEl.style.cssText = 'color:#EF4444;font-size:12px;margin-top:4px;display:none;';
    phoneInputEl.parentNode.insertBefore(phoneErrEl, phoneInputEl.nextSibling);
  }
  if (!/^\d{10}$/.test(phoneValue)) {
    phoneInputEl.style.borderColor = '#EF4444';
    phoneErrEl.textContent = '⚠ Số điện thoại phải có đúng 10 chữ số';
    phoneErrEl.style.display = 'block';
    phoneInputEl.focus();
    return;
  }
  phoneInputEl.style.borderColor = '';
  phoneErrEl.style.display = 'none';

  const dobValue = data.get('dateOfBirth');
  const dobErr   = validateDOB(dobValue);
  const dobInputEl = document.getElementById('editDateOfBirth');
  let   dobErrEl   = document.getElementById('editDobError');
  if (!dobErrEl) {
    dobErrEl = document.createElement('div');
    dobErrEl.id = 'editDobError';
    dobErrEl.style.cssText = 'color:#EF4444;font-size:12px;margin-top:4px;display:none;';
    dobInputEl.parentNode.insertBefore(dobErrEl, dobInputEl.nextSibling);
  }
  if (dobErr) {
    dobInputEl.style.borderColor = '#EF4444';
    dobErrEl.textContent = '⚠ ' + dobErr;
    dobErrEl.style.display = 'block';
    dobInputEl.focus();
    return;
  }
  dobInputEl.style.borderColor = '';
  dobErrEl.style.display = 'none';

  const ngay = document.getElementById('editAppointmentDate').value;
  const gio = data.get('appointmentTime');
  const maBs = data.get('doctor');
  if (!ngay || !gio || !maBs) {
    alert('Vui lòng chọn đủ khoa, bác sĩ, ngày và giờ khám.');
    return;
  }

  try {
    await Api.bookings.update(editingAppointmentId, {
      ngay_kham: ngay,
      gio_bat_dau_kham: gio,
      ma_bac_si: maBs,
      mo_ta_trieu_chung: (data.get("reasonForVisit") || "").trim()
    });
    showToast('Cập nhật lịch hẹn thành công!');
    await loadMine();
    setTimeout(showListView, 800);
  } catch (err) {
    alert(err.message || 'Cập nhật thất bại');
  }
});

function cancelEdit() {
  showListView();
}


// =====================
// Utility Functions
// =====================

function getDepartmentLabel(maKhoa) {
  const d = deptList.find(x => x.ma_khoa === maKhoa);
  return d ? d.ten_khoa : maKhoa || '';
}

async function updateDoctorList(departmentSelectId, doctorSelectId) {
  const maKhoa = document.getElementById(departmentSelectId).value;
  const doctorSelect = document.getElementById(doctorSelectId);
  doctorSelect.innerHTML = '<option value="">Chọn bác sĩ</option>';
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
      const option = document.createElement('option');
      option.value = d.ma_bac_si;
      option.textContent = d.ho_ten_bac_si;
      doctorSelect.appendChild(option);
    });
    doctorSelect.disabled = items.length === 0;
  } catch (e) {
    console.error(e);
    doctorSelect.disabled = true;
  }
}

function getDoctorName(doctorId) {
  return doctorLabelMap.get(doctorId) || null;
}

function formatDateToVietnamese(dateStr) {
  if (!dateStr) return '';
  const date  = new Date(dateStr);
  const day   = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year  = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr;
  const date  = new Date(dateStr);
  const day   = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year  = date.getFullYear();
  return `${day}/${month}/${year}`;
}


// =====================
// Toast Notification
// =====================

function showToast(message) {
  document.getElementById('toastMessage').textContent = message;
  document.getElementById('toastContainer').classList.add('show');
  setTimeout(closeToast, 5000);
}

function closeToast() {
  document.getElementById('toastContainer').classList.remove('show');
}


// =====================
// Initialize
// =====================

(async function initLichHen() {
  await loadDepartmentsForEdit();
  await loadMine();
})();

// Time slot click handler
document.querySelectorAll('#editTimeGrid .time-slot').forEach(button => {
  button.addEventListener('click', function () {
    document.querySelectorAll('#editTimeGrid .time-slot').forEach(btn => btn.classList.remove('selected'));
    this.classList.add('selected');
    document.getElementById('editAppointmentTime').value = this.dataset.time;
  });
});


// ── Custom Calendar for edit form ─────────────────────────────────────────────
(function () {
  const todayE = new Date();
  todayE.setHours(0, 0, 0, 0);

  let calYear      = todayE.getFullYear();
  let calMonth     = todayE.getMonth();
  let selectedDate = null;

  const MONTHS_VI = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                     'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
  const DAYS_VI   = ['CN','T2','T3','T4','T5','T6','T7'];

  function pad(n)            { return String(n).padStart(2, '0'); }
  function fmtDDMMYYYY(d)    { return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
  function toISO(d)          { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

  function render() {
    const cal = document.getElementById('editCalendar');
    if (!cal) return;

    const firstDay    = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    let html = `
      <div class="cal-header">
        <button type="button" id="editCalPrev">&#8249;</button>
        <span class="cal-month-year">${MONTHS_VI[calMonth]} ${calYear}</span>
        <button type="button" id="editCalNext">&#8250;</button>
      </div>
      <div class="cal-weekdays">${DAYS_VI.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cal-days">`;

    for (let i = 0; i < firstDay; i++) {
      html += `<button type="button" class="cal-day empty" disabled></button>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date       = new Date(calYear, calMonth, d);
      date.setHours(0, 0, 0, 0);
      const isPast     = date < todayE;
      const isWeekend  = date.getDay() === 0 || date.getDay() === 6;
      const isDisabled = isPast || isWeekend;
      const isToday    = date.getTime() === todayE.getTime();
      const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
      let cls = 'cal-day';
      if (isDisabled) cls += ' disabled';
      if (isWeekend)  cls += ' weekend';
      if (isToday)    cls += ' today';
      if (isSelected) cls += ' selected';
      html += `<button type="button" class="${cls}" ${isDisabled ? 'disabled' : ''} data-ts="${date.getTime()}">${d}</button>`;
    }
    html += `</div>`;
    cal.innerHTML = html;

    document.getElementById('editCalPrev').addEventListener('click', function (e) {
      e.stopPropagation();
      if (--calMonth < 0) { calMonth = 11; calYear--; }
      render();
    });
    document.getElementById('editCalNext').addEventListener('click', function (e) {
      e.stopPropagation();
      if (++calMonth > 11) { calMonth = 0; calYear++; }
      render();
    });

    cal.querySelectorAll('.cal-day:not(.empty):not(.disabled)').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        selectedDate = new Date(parseInt(this.dataset.ts));
        document.getElementById('editAppointmentDate').value = toISO(selectedDate);
        const txt = document.getElementById('editDateText');
        if (txt) { txt.textContent = fmtDDMMYYYY(selectedDate); txt.style.color = '#374151'; }
        cal.classList.remove('open');
        render();
        resetEditConfirm();
        checkEditConfirmBtn();
      });
    });
  }

  window.toggleEditCalendar = function (e) {
    if (e) e.stopPropagation();
    const cal = document.getElementById('editCalendar');
    if (!cal) return;
    if (cal.classList.contains('open')) {
      cal.classList.remove('open');
      return;
    }
    // Initialise position from prefilled date if not yet manually picked
    if (window._editCalInitDate && !selectedDate) {
      const d = new Date(window._editCalInitDate);
      if (!isNaN(d)) {
        selectedDate = new Date(d);
        selectedDate.setHours(0, 0, 0, 0);
        calYear  = selectedDate.getFullYear();
        calMonth = selectedDate.getMonth();
      }
    } else if (selectedDate) {
      calYear  = selectedDate.getFullYear();
      calMonth = selectedDate.getMonth();
    } else {
      calYear  = todayE.getFullYear();
      calMonth = todayE.getMonth();
    }
    cal.classList.add('open');
    render();
  };

  // Close when clicking outside the wrapper
  document.addEventListener('click', function (e) {
    const wrapper = document.getElementById('editDateWrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      const cal = document.getElementById('editCalendar');
      if (cal) cal.classList.remove('open');
    }
  });

  // Reset calendar state (called when leaving edit view)
  window._resetEditCalendar = function () {
    selectedDate = null;
    window._editCalInitDate = null;
    const txt = document.getElementById('editDateText');
    if (txt) { txt.textContent = 'Chọn ngày khám'; txt.style.color = '#9CA3AF'; }
    const hidden = document.getElementById('editAppointmentDate');
    if (hidden) hidden.value = '';
    const cal = document.getElementById('editCalendar');
    if (cal) cal.classList.remove('open');
  };
})();


// ── Confirm Date Button ───────────────────────────────────────────────────────

function checkEditConfirmBtn() {
  const dept = document.getElementById('editDepartment').value;
  const date = document.getElementById('editAppointmentDate').value;
  const btn  = document.getElementById('editConfirmDateBtn');
  if (!btn || btn.classList.contains('confirmed')) return;
  btn.disabled = !(dept && date);
}

function confirmEditDate() {
  const btn     = document.getElementById('editConfirmDateBtn');
  const section = document.getElementById('editTimeSlotSection');
  if (!btn || !section) return;
  section.style.display = 'block';
  btn.classList.add('confirmed');
  btn.disabled = true;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Đã xác nhận';
}

function resetEditConfirm() {
  const btn     = document.getElementById('editConfirmDateBtn');
  const section = document.getElementById('editTimeSlotSection');
  if (!btn || !btn.classList.contains('confirmed')) return;
  btn.classList.remove('confirmed');
  btn.disabled = true;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Xác nhận';
  if (section) section.style.display = 'none';
  document.querySelectorAll('#editTimeGrid .time-slot').forEach(b => b.classList.remove('selected'));
  const timeInput = document.getElementById('editAppointmentTime');
  if (timeInput) timeInput.value = '';
}

document.getElementById('editDepartment').addEventListener('change', async function () {
  await updateDoctorList('editDepartment', 'editDoctor');
  resetEditConfirm();
  checkEditConfirmBtn();
});


// ── Validate ngày sinh dd/mm/yyyy < ngày hiện tại ───────────────────────────
function validateDOB(value) {
  if (!value || value.length < 10) return 'Vui lòng nhập ngày sinh (DD/MM/YYYY)';
  const parts = value.split('/');
  if (parts.length !== 3) return 'Định dạng ngày sinh không hợp lệ (DD/MM/YYYY)';
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy) return 'Vui lòng nhập ngày sinh hợp lệ';
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1900)
    return 'Ngày sinh không hợp lệ';
  const dateObj = new Date(yyyy, mm - 1, dd);
  if (dateObj.getFullYear() !== yyyy || dateObj.getMonth() !== mm - 1 || dateObj.getDate() !== dd)
    return 'Ngày không tồn tại, vui lòng kiểm tra lại';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateObj >= today) return 'Ngày sinh phải nhỏ hơn ngày hiện tại';
  return null;
}

// ── DOB auto-format dd/mm/yyyy ────────────────────────────────────────────────
(function () {
  const dob = document.getElementById('editDateOfBirth');
  if (!dob) return;
  dob.addEventListener('input', function () {
    let raw = this.value.replace(/\D/g, '');
    let fmt = '';
    if (raw.length > 0) fmt  = raw.substring(0, 2);
    if (raw.length > 2) fmt += '/' + raw.substring(2, 4);
    if (raw.length > 4) fmt += '/' + raw.substring(4, 8);
    this.value = fmt;
    // Xoá lỗi khi người dùng đang nhập
    const errEl = document.getElementById('editDobError');
    if (errEl) errEl.style.display = 'none';
    dob.style.borderColor = '';
  });
})();


// ── Số điện thoại: chỉ nhận đúng 10 chữ số ───────────────────────────────────
(function () {
  const phoneInput = document.querySelector('input[name="phoneNumber"]');
  if (!phoneInput) return;
  // Lọc realtime: chỉ số, tối đa 10 ký tự
  phoneInput.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
    const errEl = document.getElementById('editPhoneError');
    if (errEl) errEl.style.display = 'none';
    this.style.borderColor = '';
  });
  // Chặn nhập ký tự không phải số từ bàn phím
  phoneInput.addEventListener('keydown', function (e) {
    const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
    if (allowed.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ['a','c','v','x'].includes(e.key.toLowerCase())) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  });
})();