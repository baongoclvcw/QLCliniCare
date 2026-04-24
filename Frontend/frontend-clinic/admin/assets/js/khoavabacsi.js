// ═══════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════

let khoaData = [];
let doctorData = {};

async function refreshKhoaBacSiFromApi() {
  try {
    const depts = await Api.departments.getAll();
    const docRes = await Api.doctors.getAll();
    const allDocs = docRes.items || [];
    khoaData = depts.map(d => ({
      id: d.ma_khoa,
      ma: d.ma_khoa,
      ten: d.ten_khoa,
      truong: d.truong_khoa || "—",
      soBacSi: 0
    }));
    doctorData = {};
    khoaData.forEach(k => {
      doctorData[k.id] = [];
    });
    allDocs.forEach(d => {
      const kId = d.ma_khoa;
      if (!doctorData[kId]) doctorData[kId] = [];
      doctorData[kId].push({
        id: d.ma_bac_si,
        name: d.ho_ten_bac_si,
        specialty: d.chuyen_khoa || "",
        phone: d.so_dien_thoai || "",
        email: d.email || "",
        chucVu: d.chuc_danh || "",
        namKN: d.so_nam_kinh_nghiem || 0,
        ngaySinh: d.ngay_sinh ? String(d.ngay_sinh).split("T")[0] : "",
        gioiTinh: d.gioi_tinh || "",
        maBacSi: d.ma_bac_si,
        lichLamViec: "",
        diaChi: d.dia_chi || "",
        moTa: d.mo_ta_kinh_nghiem || ""
      });
    });
    renderKhoaTable();
    if (currentKhoaId) renderDoctorTable(currentKhoaId);
    if (currentDoctorId) renderDoctorDetail(currentDoctorId);
  } catch (e) {
    console.error(e);
    showToast("Lỗi tải dữ liệu: " + (e.message || ""));
  }
}

// Default schedule: Sáng 7:00-11:00, Chiều 13:30-16:30
function getDefaultSchedule() {
  return { morning: { start: 7*60, end: 11*60 }, afternoon: { start: 13*60+30, end: 16*60+30 } };
}

// Store work hours per doctor (T2-T6 unified schedule)
const doctorWorkHours = {};

function getDocWorkHours(doctorId) {
  if (!doctorWorkHours[doctorId]) {
    doctorWorkHours[doctorId] = { morning: { start: '07:00', end: '11:00' }, afternoon: { start: '13:30', end: '16:30' } };
  }
  return doctorWorkHours[doctorId];
}

const DOW_VI_SHORT = { 1: "Thứ 2", 2: "Thứ 3", 3: "Thứ 4", 4: "Thứ 5", 5: "Thứ 6" };

function getWorkingDowListForDoctor(maBs) {
  const from = maBs && doctorRepeatDowFromServer[maBs];
  if (from && from.length) return [...from].filter(d => d >= 1 && d <= 5).sort((a, b) => a - b);
  return [1, 2, 3, 4, 5];
}

function formatWorkingDaysSummary(maBs) {
  const dows = getWorkingDowListForDoctor(maBs);
  return dows.map(d => DOW_VI_SHORT[d] || "").filter(Boolean).join(", ");
}

function renderWorkHoursDisplay() {
  const container = document.getElementById('workHoursDisplay');
  if (!container) return;
  const wh = getDocWorkHours(currentDoctorId);
  const dows = getWorkingDowListForDoctor(currentDoctorId);
  const dayLabels = dows.map(d => DOW_VI_SHORT[d] || `Thứ ${d + 1}`);
  container.innerHTML = `
    <div class="work-hours-grid">
      ${dayLabels.map(day => `
        <div class="work-hours-day">
          <div class="work-hours-day-label">${day}</div>
          <div class="work-hours-session">
            <span class="session-label">Buổi sáng</span>
            <span>${wh.morning.start} – ${wh.morning.end}</span>
          </div>
          <div class="work-hours-session" style="margin-bottom:0;">
            <span class="session-label">Buổi chiều</span>
            <span>${wh.afternoon.start} – ${wh.afternoon.end}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openWorkHoursEditModal() { openWorkHoursPopup(); }

function parseHHMMToMins(t) {
  const [h, m] = String(t || "0:0").split(":").map(x => parseInt(x, 10) || 0);
  return h * 60 + m;
}

/** Đồng bộ SCHED_DEFAULT_KEY từ doctorWorkHours (phút) trước khi mở popup */
function syncDefaultScheduleFromWorkHours(maBs) {
  if (!maBs) return;
  if (!doctorSchedules[maBs]) doctorSchedules[maBs] = {};
  const wh = getDocWorkHours(maBs);
  doctorSchedules[maBs][SCHED_DEFAULT_KEY] = {
    morning: { start: parseHHMMToMins(wh.morning.start), end: parseHHMMToMins(wh.morning.end) },
    afternoon: { start: parseHHMMToMins(wh.afternoon.start), end: parseHHMMToMins(wh.afternoon.end) }
  };
}

/** Mỗi lần mở popup: state khung giờ luôn bản sao từ cấu hình chuẩn (tránh sót lần sửa trước gây lệch / lỗi lưu) */
function primePopupDayFromDefault(dayKey) {
  if (!currentDoctorId || !dayKey) return;
  if (!doctorSchedules[currentDoctorId]) doctorSchedules[currentDoctorId] = {};
  const base = doctorSchedules[currentDoctorId][SCHED_DEFAULT_KEY] || getDefaultSchedule();
  doctorSchedules[currentDoctorId][dayKey] = {
    morning: { start: base.morning.start, end: base.morning.end },
    afternoon: { start: base.afternoon.start, end: base.afternoon.end }
  };
}

async function openWorkHoursPopup() {
  const now = new Date();
  const key = dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
  await openDaySchedule(key);
  document.getElementById("schedPopupTitle").textContent = "Chỉnh sửa giờ làm việc";
  const sub = formatWorkingDaysSummary(currentDoctorId) || "Thứ 2 – Thứ 6";
  document.getElementById("schedPopupSub").textContent =
    `Kéo thanh để điều chỉnh khung giờ – áp dụng các ngày: ${sub}`;
}

function saveWorkHours() {
  // Không dùng nữa, giữ để tránh lỗi tham chiếu
}


const doctorSchedules = {};

function getDoctorSchedule(doctorId, day) {
  if (!doctorSchedules[doctorId]) doctorSchedules[doctorId] = {};
  if (!doctorSchedules[doctorId][day]) doctorSchedules[doctorId][day] = getDefaultSchedule();
  return doctorSchedules[doctorId][day];
}

// State
let currentKhoaId = null;
let currentDoctorId = null;
let toastTimer = null;
let khoaIdCounter = 100;
let doctorIdCounter = 9000;
let activeDayTab = null;

// ═══════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goToKhoa() {
  currentKhoaId = null;
  currentDoctorId = null;
  document.getElementById('topbarTitle').textContent = 'Quản lý khoa và bác sĩ';
  document.getElementById('searchInput').value = '';
  renderKhoaTable();
  showView('viewKhoa');
}

function goToKhoaBacSi(khoaId) {
  currentKhoaId = khoaId;
  const khoa = khoaData.find(k => k.id === khoaId);
  document.getElementById('topbarTitle').textContent = 'Khoa ' + khoa.ten;
  document.getElementById('breadKhoa').textContent = 'Khoa ' + khoa.ten;
  document.getElementById('searchInput').value = '';
  renderDoctorTable(khoaId);
  showView('viewBacSi');
}

function goToBacSi() {
  if (currentKhoaId) goToKhoaBacSi(currentKhoaId);
}

async function goToChiTiet(doctorId) {
  currentDoctorId = doctorId;
  popupDateKey = null;
  const now = new Date();
  calViewYear  = now.getFullYear();
  calViewMonth = now.getMonth();
  await syncDoctorWorkingHoursFromApi(doctorId);
  renderDoctorDetail(doctorId);
  showView('viewChiTiet');
}

// ═══════════════════════════════════════════════════════════════
// RENDER KHOA TABLE
// ═══════════════════════════════════════════════════════════════

function renderKhoaTable() {
  const tbody = document.getElementById('khoaTableBody');
  tbody.innerHTML = khoaData.map((k, i) => `
    <tr class="row-link" onclick='goToKhoaBacSi(${JSON.stringify(k.id)})'>
      <td class="stt">${i + 1}</td>
      <td class="ma-khoa">${k.ma}</td>
      <td class="ten-khoa">${k.ten}</td>
      <td class="truong-khoa">${k.truong || '—'}</td>
      <td class="so-bac-si">${(doctorData[k.id] || []).length}</td>
    </tr>
  `).join('');
  document.getElementById('totalKhoa').textContent = khoaData.length;
  document.getElementById('totalBacSi').textContent = Object.values(doctorData).reduce((s, arr) => s + arr.length, 0);
}

// ═══════════════════════════════════════════════════════════════
// RENDER DOCTOR TABLE
// ═══════════════════════════════════════════════════════════════

function renderDoctorTable(khoaId) {
  const khoa = khoaData.find(k => k.id === khoaId);
  const doctors = doctorData[khoaId] || [];

  document.getElementById('khoaInfoCards').innerHTML = `
    <div class="info-card"><div class="label">Tên khoa</div><div class="value">${khoa.ten}</div></div>
    <div class="info-card"><div class="label">Trưởng khoa</div><div class="value">${khoa.truong || '—'}</div></div>
    <div class="info-card"><div class="label">Số lượng bác sĩ</div><div class="value" id="cardCount">${doctors.length} bác sĩ</div></div>
  `;
  document.getElementById('doctorCount').textContent = doctors.length;
  document.getElementById('addDoctorSubtitle').textContent = 'Điền thông tin để thêm bác sĩ vào Khoa ' + khoa.ten;

  const tbody = document.getElementById('doctorTableBody');
  if (doctors.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted);">Chưa có bác sĩ trong khoa này</td></tr>`;
    return;
  }
  tbody.innerHTML = doctors.map((d, i) => `
    <tr class="row-link" onclick='goToChiTiet(${JSON.stringify(d.id)})'>
      <td class="stt">${i + 1}</td>
      <td class="name">${d.name}</td>
      <td class="specialty">${d.specialty}</td>
      <td class="phone">${d.phone || '—'}</td>
      <td class="email">${d.email || '—'}</td>
    </tr>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════
// RENDER DOCTOR DETAIL
// ═══════════════════════════════════════════════════════════════

function renderDoctorDetail(doctorId) {
  let doctor = null;
  for (const kId in doctorData) {
    const found = doctorData[kId].find(d => d.id === doctorId);
    if (found) { doctor = found; break; }
  }
  if (!doctor) return;

  const khoa = khoaData.find(k => k.id === currentKhoaId);

  document.getElementById('detailName').textContent = doctor.name;
  document.getElementById('detailSub').textContent = `${doctor.chucVu} • ${doctor.namKN} năm kinh nghiệm`;
  document.getElementById('breadKhoa2').textContent = 'Khoa ' + (khoa ? khoa.ten : '');
  document.getElementById('breadBacSi').textContent = doctor.name;
  document.getElementById('topbarTitle').textContent = doctor.name;

  document.getElementById('detailInfoGrid').innerHTML = `
    <div><div class="info-label">Mã bác sĩ</div><div class="info-value">${doctor.maBacSi}</div></div>
    <div><div class="info-label">Họ và tên</div><div class="info-value">${doctor.name}</div></div>
    <div><div class="info-label">Giới tính</div><div class="info-value">${doctor.gioiTinh}</div></div>
    <div><div class="info-label">Ngày sinh</div><div class="info-value">${doctor.ngaySinh && doctor.ngaySinh.includes('-') ? (() => { const [y,m,dd] = doctor.ngaySinh.split('-'); return `${dd}/${m}/${y}`; })() : (doctor.ngaySinh || '—')}</div></div>
    <div><div class="info-label">Số điện thoại</div><div class="info-value">${doctor.phone}</div></div>
    <div><div class="info-label">Email</div><div class="info-value">${doctor.email}</div></div>
    <div><div class="info-label">Khoa</div><div class="info-value">${khoa ? 'Khoa ' + khoa.ten : '—'}</div></div>
    <div><div class="info-label">Chuyên khoa</div><div class="info-value">${doctor.specialty}</div></div>
    <div><div class="info-label">Chức danh</div><div class="info-value">${doctor.chucVu}</div></div>
    <div><div class="info-label">Số năm kinh nghiệm</div><div class="info-value">${doctor.namKN} năm</div></div>
    <div><div class="info-label">Lịch làm việc</div><div class="info-value">${formatWorkingDaysSummary(doctorId) || "Thứ 2 – Thứ 6"}</div></div>
  `;

  document.getElementById('detailSupp').innerHTML = `
    <div><div class="supp-label">Địa chỉ</div><div class="supp-value">${doctor.diaChi}</div></div>
    <div><div class="supp-label">Mô tả kinh nghiệm</div><div class="supp-value">${doctor.moTa}</div></div>
  `;

  renderWorkHoursDisplay();
}

// ═══════════════════════════════════════════════════════════════
// CALENDAR DATEPICKER
// ═══════════════════════════════════════════════════════════════

function minToStr(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minutesToSqlTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function localTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseTimeToMins(t) {
  if (t == null || t === "") return null;
  const s = String(t).trim().slice(0, 8);
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

const SCHED_DEFAULT_KEY = "__default__";

let calViewYear, calViewMonth; // currently displayed month
let popupDateKey = null; // 'YYYY-MM-DD' of open day

const VI_MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const DOW_LABELS = ['CN','T2','T3','T4','T5','T6','T7'];
const DOW_SHORT  = ['CN','T2','T3','T4','T5','T6','T7'];

function renderCalendarForDoctor() {
  if (!calViewYear) {
    const now = new Date();
    calViewYear  = now.getFullYear();
    calViewMonth = now.getMonth();
  }
  renderCalendar();
}

function renderCalendar() {
  const today = new Date();
  const y = calViewYear, m = calViewMonth;
  const firstDay = new Date(y, m, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  // Build saved schedules list for current doctor
  const EDIT_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const DOW_FULL = ['CN','T2','T3','T4','T5','T6','T7'];
  const MO_SHORT = ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'];

  let savedHtml = '';
  const rawKeys = (doctorSchedules[currentDoctorId] && Object.keys(doctorSchedules[currentDoctorId])) || [];
  const schedEntries = rawKeys.filter(k => k !== SCHED_DEFAULT_KEY && /^\d{4}-\d{2}-\d{2}$/.test(k));
  if (schedEntries.length > 0) {
    const sorted = [...schedEntries].sort();
    savedHtml = `<div class="saved-schedules">`;
    sorted.forEach(key => {
      const [sy, smo, sd] = key.split('-').map(Number);
      const dateObj = new Date(sy, smo-1, sd);
      const dow = DOW_FULL[dateObj.getDay()];
      const sched = doctorSchedules[currentDoctorId][key];
      const morningStr = minToStr(sched.morning.start) + ' – ' + minToStr(sched.morning.end);
      const afternoonStr = minToStr(sched.afternoon.start) + ' – ' + minToStr(sched.afternoon.end);
      savedHtml += `
        <div class="saved-schedule-row">
          <div class="saved-schedule-info">
            <div class="saved-schedule-date">${dow}, ${sd}/${smo}/${sy}</div>
            <div class="saved-schedule-times">
              <span class="saved-schedule-badge">Buổi sáng: ${morningStr}</span>
              <span class="saved-schedule-badge">Buổi chiều: ${afternoonStr}</span>
            </div>
          </div>
          <button class="btn-edit-sched" onclick="void openDaySchedule('${key}').catch(function(e){console.error(e);alert(e.message||'Không mở được lịch');})">${EDIT_SVG} Chỉnh sửa</button>
        </div>`;
    });
    savedHtml += `</div>`;
  } else {
    savedHtml = `<div class="cal-no-schedule">Chưa có lịch làm việc nào được lưu. Chọn ngày trên lịch để thêm lịch.</div>`;
  }

  let html = savedHtml + `
    <div class="cal-nav">
      <button class="cal-nav-btn" onclick="calPrev()">&#8249;</button>
      <span class="cal-nav-title">${VI_MONTHS[m]} ${y}</span>
      <button class="cal-nav-btn" onclick="calNext()">&#8250;</button>
    </div>
    <div class="cal-grid">
      ${DOW_LABELS.map(d => `<div class="cal-dow">${d}</div>`).join('')}
  `;

  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day cal-empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(y, m, d);
    const key = dateKey(y, m + 1, d);
    const isToday = sameDay(dateObj, today);
    const isPast  = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const hasSchedule = !!(doctorSchedules[currentDoctorId] && doctorSchedules[currentDoctorId][key]);
    const isSelected = (key === popupDateKey);

    let cls = 'cal-day';
    if (isPast) cls += ' cal-past';
    if (isToday) cls += ' cal-today';
    if (hasSchedule) cls += ' cal-has-schedule';
    if (isSelected) cls += ' cal-selected';

    const click = isPast ? "" : `onclick="void openDaySchedule('${key}').catch(function(e){console.error(e);alert(e.message||'Không mở được lịch');})"`;
    html += `<div class="${cls}" ${click}>${d}</div>`;
  }
  html += `</div>`;

  const widget = document.getElementById('calendarWidget');
  if (widget) widget.innerHTML = html;
}

function dateKey(y, m, d) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function calPrev() {
  calViewMonth--;
  if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
  renderCalendar();
}

function calNext() {
  calViewMonth++;
  if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
  renderCalendar();
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULE POPUP
// ═══════════════════════════════════════════════════════════════

const DOW_CHIP_LABELS = ['T2','T3','T4','T5','T6'];
/** Chip T2..T6 ↔ JS getDay(): T2=1 … T6=5 (Mon..Fri) */
const CHIP_INDEX_TO_JS_DOW = [1, 2, 3, 4, 5];
// Set các giá trị getDay() 1..5 (thứ 2 → thứ 6)
let repeatActiveDays = new Set([1, 2, 3, 4, 5]);

/** Đồng bộ thứ làm việc đã lưu trên server (ghi_chu: mô tả + " | DOW:1,2,…|") */
const doctorRepeatDowFromServer = {};
/** Bản sao ghi_chu cấu hình giờ làm mới nhất (DOW + tùy chọn END:YYYY-MM-DD|) */
const doctorGhiChuSnapshot = {};

function parseDowFromGhiChu(gc) {
  const m = String(gc || "").match(/DOW:([\d,]+)/);
  if (!m) return null;
  const nums = m[1].split(",").map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 5);
  return nums.length ? nums : null;
}

/** Thứ 2–6 (Mon–Fri trong JS getDay): 1→T2 … 5→T6 — khớp chip lặp lịch */
const JS_DOW_TO_CHIP_LABEL = { 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6" };

/**
 * Nội dung hiển thị trong SQL cột ghi_chu (phần mô tả); luôn kèm DOW:…| sau đó để parse.
 * Đủ T2–T6 → câu mặc định; lệch → liệt kê đúng các thứ đã chọn.
 */
function formatWorkingDaysGhiChuHuman(dowSorted) {
  const sorted = [...dowSorted].sort((a, b) => a - b);
  const isFullWeek = sorted.length === 5 && sorted.join(",") === "1,2,3,4,5";
  if (isFullWeek) return "Làm việc từ thứ 2 đến thứ 6";
  const labels = sorted.map(d => JS_DOW_TO_CHIP_LABEL[d]).filter(Boolean);
  return `Làm việc các thứ: ${labels.join(", ")}`;
}

function parseEndsFromGhiChu(gc) {
  const m = String(gc || "").match(/\|END:(\d{4}-\d{2}-\d{2})\|/);
  return m ? m[1] : null;
}

function applyEndsUiFromGhiChu() {
  const gc = currentDoctorId ? doctorGhiChuSnapshot[currentDoctorId] : "";
  const end = parseEndsFromGhiChu(gc);
  const neverRadio = document.querySelector('input[name=endsOption][value="never"]');
  const onRadio = document.querySelector('input[name=endsOption][value="on"]');
  const endsInput = document.getElementById("endsDateInput");
  if (!neverRadio || !onRadio || !endsInput) return;
  if (end) {
    onRadio.checked = true;
    neverRadio.checked = false;
    endsInput.disabled = false;
    endsInput.value = end;
  } else {
    neverRadio.checked = true;
    onRadio.checked = false;
    endsInput.disabled = true;
    endsInput.value = "";
  }
}

function ensureDaySchedule(dayKey) {
  if (!currentDoctorId || !dayKey) return;
  if (!doctorSchedules[currentDoctorId]) doctorSchedules[currentDoctorId] = {};
  if (doctorSchedules[currentDoctorId][dayKey]) return;
  const base = doctorSchedules[currentDoctorId][SCHED_DEFAULT_KEY] || getDefaultSchedule();
  doctorSchedules[currentDoctorId][dayKey] = {
    morning: { start: base.morning.start, end: base.morning.end },
    afternoon: { start: base.afternoon.start, end: base.afternoon.end }
  };
}

async function syncDoctorWorkingHoursFromApi(maBs) {
  try {
    const dr = await Api.doctors.getById(maBs);
    const wh = dr.gio_lam_viec;
    doctorGhiChuSnapshot[maBs] = wh && wh.ghi_chu != null ? String(wh.ghi_chu) : "";
    const dowParsed = parseDowFromGhiChu(wh && wh.ghi_chu);
    if (dowParsed) doctorRepeatDowFromServer[maBs] = dowParsed;
    else delete doctorRepeatDowFromServer[maBs];
    if (wh && (wh.sang_bd || wh.chieu_bd)) {
      const pad5 = s => (s ? String(s).trim().slice(0, 5) : "");
      doctorWorkHours[maBs] = {
        morning: { start: pad5(wh.sang_bd) || "07:00", end: pad5(wh.sang_kt) || "11:00" },
        afternoon: { start: pad5(wh.chieu_bd) || "13:30", end: pad5(wh.chieu_kt) || "16:30" }
      };
      const def = {
        morning: {
          start: parseTimeToMins(wh.sang_bd) ?? 7 * 60,
          end: parseTimeToMins(wh.sang_kt) ?? 11 * 60
        },
        afternoon: {
          start: parseTimeToMins(wh.chieu_bd) ?? 13 * 60 + 30,
          end: parseTimeToMins(wh.chieu_kt) ?? 16 * 60 + 30
        }
      };
      if (!doctorSchedules[maBs]) doctorSchedules[maBs] = {};
      doctorSchedules[maBs][SCHED_DEFAULT_KEY] = def;
    }
  } catch (e) {
    console.error(e);
  }
}

async function openDaySchedule(key) {
  if (currentDoctorId) {
    await syncDoctorWorkingHoursFromApi(currentDoctorId);
    syncDefaultScheduleFromWorkHours(currentDoctorId);
  }

  popupDateKey = key;
  const [y, mo, d] = key.split("-").map(Number);
  const dateObj = new Date(y, mo - 1, d);
  const dowIndex = dateObj.getDay();
  const dowNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const moNames = [
    "tháng 1",
    "tháng 2",
    "tháng 3",
    "tháng 4",
    "tháng 5",
    "tháng 6",
    "tháng 7",
    "tháng 8",
    "tháng 9",
    "tháng 10",
    "tháng 11",
    "tháng 12"
  ];

  document.getElementById("schedPopupTitle").textContent = `Lịch làm việc – ${dowNames[dowIndex]}, ${d} ${moNames[mo - 1]} ${y}`;
  document.getElementById("schedPopupSub").textContent =
    "Khung giờ áp dụng cho các thứ được chọn (T2–T6). Lưu sẽ cập nhật server và trang đặt lịch bệnh nhân.";

  const savedDow = currentDoctorId && doctorRepeatDowFromServer[currentDoctorId];
  repeatActiveDays = savedDow && savedDow.length ? new Set(savedDow) : new Set([1, 2, 3, 4, 5]);
  renderRepeatChips();

  primePopupDayFromDefault(key);
  applyEndsUiFromGhiChu();

  renderPopupTimeline(key);

  document.getElementById("schedPopup").classList.add("open");
  renderCalendar();
}

function closeSchedPopup() {
  popupDateKey = null;
  document.getElementById('schedPopup').classList.remove('open');
  renderCalendar();
}

function renderRepeatChips() {
  const container = document.getElementById('repeatChips');
  container.innerHTML = DOW_CHIP_LABELS.map((label, i) => {
    const jsDow = CHIP_INDEX_TO_JS_DOW[i];
    const on = repeatActiveDays.has(jsDow);
    return `<button type="button" class="dow-chip${on ? " active" : ""}" data-dow="${jsDow}">${label}</button>`;
  }).join('');
  container.querySelectorAll(".dow-chip").forEach(btn => {
    btn.addEventListener("click", () => toggleRepeatDay(parseInt(btn.getAttribute("data-dow"), 10)));
  });
}

function toggleRepeatDay(jsDow) {
  if (jsDow < 1 || jsDow > 5) return;
  if (repeatActiveDays.has(jsDow)) {
    if (repeatActiveDays.size > 1) repeatActiveDays.delete(jsDow);
  } else {
    repeatActiveDays.add(jsDow);
  }
  renderRepeatChips();
}

function onEndsChange(radio) {
  const endsInput = document.getElementById("endsDateInput");
  endsInput.disabled = radio.value !== "on";
  if (radio.value === "on" && !endsInput.value && popupDateKey) {
    const [y, mo, d] = popupDateKey.split("-").map(Number);
    const endDate = new Date(y, mo - 1 + 1, d);
    endsInput.value = dateKey(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate());
  }
}

function roundScheduleMins(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : NaN;
}

async function saveSchedPopup() {
  const dayKey = popupDateKey;
  if (!dayKey || !currentDoctorId) return;

  ensureDaySchedule(dayKey);
  const saved = doctorSchedules[currentDoctorId][dayKey];
  if (!saved) return;

  if (!repeatActiveDays || repeatActiveDays.size === 0) {
    alert("Vui lòng chọn ít nhất một ngày làm việc (Thứ 2 – Thứ 6).");
    return;
  }

  const ms = roundScheduleMins(saved.morning.start);
  const me = roundScheduleMins(saved.morning.end);
  const as = roundScheduleMins(saved.afternoon.start);
  const ae = roundScheduleMins(saved.afternoon.end);
  if ([ms, me, as, ae].some(x => !Number.isFinite(x))) {
    alert("Khung giờ không hợp lệ. Vui lòng kéo lại thanh thời gian.");
    return;
  }
  if (me <= ms || ae <= as) {
    alert("Mỗi ca phải có giờ bắt đầu trước giờ kết thúc.");
    return;
  }
  if (me > as) {
    alert("Ca sáng phải kết thúc trước hoặc đúng lúc bắt đầu ca chiều (không chồng giờ).");
    return;
  }

  saved.morning.start = ms;
  saved.morning.end = me;
  saved.afternoon.start = as;
  saved.afternoon.end = ae;

  let eff = dayKey;
  const todayIso = localTodayISO();
  if (eff < todayIso) eff = todayIso;

  const dowSorted = [...repeatActiveDays].sort((a, b) => a - b);
  const humanLine = formatWorkingDaysGhiChuHuman(dowSorted);
  let ghiChu = `${humanLine} | DOW:${dowSorted.join(",")}|`;
  const onRadio = document.querySelector('input[name=endsOption][value="on"]');
  const endsInput = document.getElementById("endsDateInput");
  if (onRadio && onRadio.checked && endsInput && endsInput.value && /^\d{4}-\d{2}-\d{2}$/.test(endsInput.value)) {
    ghiChu += `END:${endsInput.value}|`;
  }

  try {
    await Api.schedules.configWorkingHours({
      ma_bac_si: currentDoctorId,
      ngay_hieu_luc: eff,
      gio_sang_bat_dau: minutesToSqlTime(ms),
      gio_sang_ket_thuc: minutesToSqlTime(me),
      gio_chieu_bat_dau: minutesToSqlTime(as),
      gio_chieu_ket_thuc: minutesToSqlTime(ae),
      ghi_chu: ghiChu,
      ngay_lam_trong_tuan: dowSorted
    });

    doctorGhiChuSnapshot[currentDoctorId] = ghiChu;
    doctorWorkHours[currentDoctorId] = {
      morning: { start: minToStr(ms), end: minToStr(me) },
      afternoon: { start: minToStr(as), end: minToStr(ae) }
    };
    doctorSchedules[currentDoctorId][SCHED_DEFAULT_KEY] = {
      morning: { start: ms, end: me },
      afternoon: { start: as, end: ae }
    };

    await syncDoctorWorkingHoursFromApi(currentDoctorId);
    doctorRepeatDowFromServer[currentDoctorId] = dowSorted.slice();
    showToast("Đã lưu lịch làm việc và cập nhật khung giờ đặt lịch!");
    closeSchedPopup();
    renderWorkHoursDisplay();
    if (currentDoctorId) renderDoctorDetail(currentDoctorId);
    renderCalendar();
  } catch (e) {
    alert(e.message || "Không lưu được lịch. Kiểm tra: ca sáng phải kết thúc trước ca chiều; không chồng giờ; ngày hiệu lực không quá khứ; hoặc có lịch hẹn đã xác nhận ngoài khung giờ mới.");
  }
}

// ═══════════════════════════════════════════════════════════════
// TIMELINE IN POPUP (reused logic, scoped to popup container)
// ═══════════════════════════════════════════════════════════════

function renderPopupTimeline(dayKey) {
  ensureDaySchedule(dayKey);
  const sched = doctorSchedules[currentDoctorId][dayKey];
  const container = document.getElementById('popupWorkScheduleContainer');

  container.innerHTML = `
    <div>
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:13px;font-weight:600;color:var(--text);">Buổi sáng</span>
          <span id="popup-label-morning" style="font-size:13px;font-weight:700;color:var(--blue);background:var(--blue-light);padding:2px 10px;border-radius:20px;">${minToStr(sched.morning.start)} – ${minToStr(sched.morning.end)}</span>
        </div>
        <div style="position:relative;padding-bottom:22px;">
          <div id="popup-timeline-morning" class="timeline-track"></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:6px;padding:0 1px;">
            <span>6:00</span><span>7:00</span><span>8:00</span><span>9:00</span><span>10:00</span><span>11:00</span><span>12:00</span>
          </div>
        </div>
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:13px;font-weight:600;color:var(--text);">Buổi chiều</span>
          <span id="popup-label-afternoon" style="font-size:13px;font-weight:700;color:var(--blue);background:var(--blue-light);padding:2px 10px;border-radius:20px;">${minToStr(sched.afternoon.start)} – ${minToStr(sched.afternoon.end)}</span>
        </div>
        <div style="position:relative;padding-bottom:22px;">
          <div id="popup-timeline-afternoon" class="timeline-track"></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:6px;padding:0 1px;">
            <span>12:00</span><span>13:00</span><span>14:00</span><span>15:00</span><span>16:00</span><span>17:00</span><span>18:00</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const sessions = {
    morning:   { startBase: 6*60,  totalMins: 6*60, startMin: sched.morning.start,   endMin: sched.morning.end   },
    afternoon: { startBase: 12*60, totalMins: 6*60, startMin: sched.afternoon.start, endMin: sched.afternoon.end }
  };

  ['morning','afternoon'].forEach(session => {
    buildPopupTimeline(
      document.getElementById(`popup-timeline-${session}`),
      `popup-label-${session}`,
      session, dayKey, sessions[session]
    );
  });
}

function buildPopupTimeline(track, labelId, session, dayKey, cfg) {
  track.innerHTML = '';
  const { startBase, totalMins } = cfg;

  const bg = document.createElement('div');
  bg.className = 'timeline-bg';
  track.appendChild(bg);

  const bar = document.createElement('div');
  bar.className = 'timeline-bar';
  track.appendChild(bar);

  const handleL = document.createElement('div');
  handleL.className = 'timeline-handle handle-left';
  track.appendChild(handleL);

  const handleR = document.createElement('div');
  handleR.className = 'timeline-handle handle-right';
  track.appendChild(handleR);

  function getPercent(min) { return ((min - startBase) / totalMins) * 100; }

  function update(startMin, endMin) {
    const s = getPercent(startMin), e = getPercent(endMin);
    bar.style.left = s + '%';
    bar.style.width = (e - s) + '%';
    handleL.style.left = s + '%';
    handleR.style.left = e + '%';
    const lbl = document.getElementById(labelId);
    if (lbl) lbl.textContent = minToStr(startMin) + ' – ' + minToStr(endMin);
    const daySchedules = doctorSchedules[currentDoctorId];
    if (daySchedules && daySchedules[dayKey]) {
      daySchedules[dayKey][session].start = startMin;
      daySchedules[dayKey][session].end = endMin;
    }
  }

  const initSched = doctorSchedules[currentDoctorId][dayKey];
  update(initSched[session].start, initSched[session].end);

  function makeDrag(type) {
    return function(eDown) {
      eDown.preventDefault();
      eDown.stopPropagation();
      const trackRect = track.getBoundingClientRect();
      const startX = eDown.clientX !== undefined ? eDown.clientX : eDown.touches[0].clientX;
      const snapMin = 30;
      const cur = doctorSchedules[currentDoctorId][dayKey];
      const initStart = cur[session].start;
      const initEnd = cur[session].end;

      function onMove(eMove) {
        const clientX = eMove.clientX !== undefined ? eMove.clientX : eMove.touches[0].clientX;
        const dx = clientX - startX;
        const dPct = (dx / trackRect.width) * 100;
        const dMin = Math.round((dPct / 100) * totalMins / snapMin) * snapMin;
        let newStart = initStart, newEnd = initEnd;
        if (type === 'L') {
          newStart = Math.max(startBase, Math.min(initStart + dMin, initEnd - snapMin));
        } else if (type === 'R') {
          newEnd = Math.max(initStart + snapMin, Math.min(initEnd + dMin, startBase + totalMins));
        } else {
          const dur = initEnd - initStart;
          newStart = Math.max(startBase, Math.min(initStart + dMin, startBase + totalMins - dur));
          newEnd = newStart + dur;
        }
        update(newStart, newEnd);
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    };
  }

  handleL.addEventListener('mousedown', makeDrag('L'));
  handleL.addEventListener('touchstart', makeDrag('L'), { passive: false });
  handleR.addEventListener('mousedown', makeDrag('R'));
  handleR.addEventListener('touchstart', makeDrag('R'), { passive: false });
  bar.addEventListener('mousedown', makeDrag('BAR'));
  bar.addEventListener('touchstart', makeDrag('BAR'), { passive: false });
}

function saveWorkSchedule() {
  showToast('Đã lưu khung giờ làm việc thành công!');
}

// ═══════════════════════════════════════════════════════════════
// THÊM KHOA
// ═══════════════════════════════════════════════════════════════

function openAddKhoaModal() {
  const ten = document.getElementById('inputTenKhoa');
  const ma = document.getElementById('inputMaKhoa');
  if (ten) {
    ten.value = '';
    ten.classList.remove('error');
  }
  if (ma) {
    ma.value = '';
    ma.classList.remove('error');
  }
  const tr = document.getElementById('inputTruongKhoa');
  const sb = document.getElementById('inputSoBacSi');
  if (tr) tr.value = '';
  if (sb) sb.value = '';
  document.getElementById('modalAddKhoa').classList.add('open');
  setTimeout(() => (document.getElementById('inputTenKhoa') || ten).focus(), 150);
}

async function addKhoa() {
  const ten = document.getElementById('inputTenKhoa').value.trim();
  const maKhoa = document.getElementById('inputMaKhoa') ? document.getElementById('inputMaKhoa').value.trim() : '';
  let hasError = false;
  if (!ten) { document.getElementById('inputTenKhoa').classList.add('error'); hasError = true; }
  if (!maKhoa) {
    const el = document.getElementById('inputMaKhoa');
    if (el) el.classList.add('error');
    hasError = true;
  }
  if (hasError) return;

  try {
    await Api.departments.create({ ten_khoa: ten, ma_khoa: maKhoa, ma_bac_si: null });
    closeModal('modalAddKhoa');
    showToast(`Đã thêm khoa ${ten} thành công!`);
    await refreshKhoaBacSiFromApi();
  } catch (e) {
    alert(e.message || 'Không thêm được khoa');
  }
}

// ═══════════════════════════════════════════════════════════════
// THÊM BÁC SĨ
// ═══════════════════════════════════════════════════════════════

function openAddDoctorModal() {
  ['inputName','inputNgaySinh','inputPhone','inputEmail','inputNamKN','inputDiaChi','inputMoTa'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('error'); }
  });
  ['inputSpecialty','inputGioiTinh','inputChucVu'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('error'); }
  });
  document.getElementById('modalAddDoctor').classList.add('open');
  hideNgaySinhError();
  setTimeout(() => document.getElementById('inputName').focus(), 150);
}

function showNgaySinhError(msg) {
  const el = document.getElementById('ngaySinhError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function hideNgaySinhError() {
  const el = document.getElementById('ngaySinhError');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

async function addDoctor() {
  const name      = document.getElementById('inputName').value.trim();
  const ngaySinh  = document.getElementById('inputNgaySinh').value.trim();
  const gioiTinh  = document.getElementById('inputGioiTinh').value;
  const phone     = document.getElementById('inputPhone').value.trim();
  const email     = document.getElementById('inputEmail').value.trim();
  const specialty = document.getElementById('inputSpecialty').value;
  const chucVu    = document.getElementById('inputChucVu').value;
  const namKN     = document.getElementById('inputNamKN').value.trim();
  const diaChi    = document.getElementById('inputDiaChi').value.trim();
  const moTa      = document.getElementById('inputMoTa').value.trim();

  let hasError = false;
  const required = [
    ['inputName', name], ['inputNgaySinh', ngaySinh],
    ['inputGioiTinh', gioiTinh], ['inputPhone', phone], ['inputEmail', email],
    ['inputSpecialty', specialty], ['inputChucVu', chucVu],
    ['inputNamKN', namKN], ['inputDiaChi', diaChi], ['inputMoTa', moTa]
  ];
  required.forEach(([id, val]) => {
    if (!val) { document.getElementById(id).classList.add('error'); hasError = true; }
  });
  if (hasError) return;

  // Validate số điện thoại đúng 10 chữ số
  if (!/^\d{10}$/.test(phone)) {
    const phoneEl = document.getElementById('inputPhone');
    phoneEl.classList.add('error');
    phoneEl.focus();
    return;
  }

  // Kiểm tra ràng buộc ngày sinh: bác sĩ phải đủ 25 tuổi trở lên
  const parts = ngaySinh.split('/');
  let ngaySinhValid = false;
  let ngaySinhDu25 = false;
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    const birthDate = new Date(y, m - 1, d);
    if (!isNaN(birthDate.getTime()) && birthDate.getFullYear() === y && birthDate.getMonth() === m - 1 && birthDate.getDate() === d) {
      ngaySinhValid = true;
      const today = new Date();
      const limit = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
      if (birthDate <= limit) ngaySinhDu25 = true;
    }
  }
  if (!ngaySinhValid || !ngaySinhDu25) {
    document.getElementById('inputNgaySinh').classList.add('error');
    const errMsg = !ngaySinhValid
      ? 'Ngày sinh không hợp lệ. Vui lòng nhập đúng định dạng DD/MM/YYYY.'
      : 'Bác sĩ phải đủ 25 tuổi trở lên!';
    showNgaySinhError(errMsg);
    return;
  }
  hideNgaySinhError();

  const [dd, mm, yyyy] = ngaySinh.split('/');
  const ngayIso = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

  try {
    await Api.doctors.create({
      ho_ten_bac_si: name,
      gioi_tinh: gioiTinh,
      ngay_sinh: ngayIso,
      so_dien_thoai: phone,
      email,
      chuyen_khoa: specialty,
      chuc_danh: chucVu,
      so_nam_kinh_nghiem: parseInt(namKN, 10) || 0,
      dia_chi: diaChi,
      mo_ta_kinh_nghiem: moTa,
      ma_khoa: currentKhoaId
    });
    closeModal('modalAddDoctor');
    showToast(`Đã thêm ${name} thành công!`);
    await refreshKhoaBacSiFromApi();
    if (currentKhoaId) renderDoctorTable(currentKhoaId);
  } catch (e) {
    alert(e.message || 'Không thêm được bác sĩ');
  }
}

// ═══════════════════════════════════════════════════════════════
// CHỈNH SỬA BÁC SĨ
// ═══════════════════════════════════════════════════════════════

function openEditModal() {
  let doctor = null;
  for (const kId in doctorData) {
    const found = doctorData[kId].find(d => d.id === currentDoctorId);
    if (found) { doctor = found; break; }
  }
  if (!doctor) return;
  document.getElementById('editName').value      = doctor.name;
  document.getElementById('editPhone').value     = doctor.phone;
  document.getElementById('editSpecialty').value = doctor.specialty;
  document.getElementById('editChucVu').value    = doctor.chucVu;
  document.getElementById('editDesc').value      = doctor.moTa;
  document.getElementById('editDoctorSubtitle').textContent = 'Cập nhật thông tin ' + doctor.name;
  document.getElementById('modalEditDoctor').classList.add('open');
}

async function saveEdit() {
  const editPhoneVal = document.getElementById('editPhone').value.trim();
  if (!/^\d{10}$/.test(editPhoneVal)) {
    const el = document.getElementById('editPhone');
    el.classList.add('error');
    el.focus();
    return;
  }
  try {
    await Api.doctors.update(currentDoctorId, {
      ho_ten_bac_si: document.getElementById('editName').value.trim(),
      so_dien_thoai: editPhoneVal,
      chuyen_khoa: document.getElementById('editSpecialty').value,
      chuc_danh: document.getElementById('editChucVu').value,
      mo_ta_kinh_nghiem: document.getElementById('editDesc').value.trim()
    });
    closeModal('modalEditDoctor');
    await refreshKhoaBacSiFromApi();
    if (currentKhoaId) renderDoctorTable(currentKhoaId);
    renderDoctorDetail(currentDoctorId);
    showToast('Cập nhật thông tin thành công!');
  } catch (e) {
    alert(e.message || 'Cập nhật thất bại');
  }
}

// ═══════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════

function handleSearch() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const view = document.querySelector('.view.active').id;
  if (view === 'viewKhoa') {
    document.querySelectorAll('#khoaTableBody tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  } else if (view === 'viewBacSi') {
    document.querySelectorAll('#doctorTableBody tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════════════════════════════

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Đóng modal khi click ra ngoài
document.querySelectorAll('.modal-overlay, .sched-popup-overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o) {
      o.classList.remove('open');
      if (o.id === 'schedPopup') { popupDateKey = null; renderCalendar(); }
    }
  });
});

// Xóa lỗi khi nhập
['inputTenKhoa','inputName','inputSpecialty','inputNgaySinh','inputGioiTinh','inputPhone','inputEmail','inputNamKN','inputDiaChi','inputMoTa','inputChucVu'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', function(){
    this.classList.remove('error');
    if (id === 'inputNgaySinh') hideNgaySinhError();
  });
  if (el && el.tagName === 'SELECT') el.addEventListener('change', function(){ this.classList.remove('error'); });
});

// ── Số điện thoại: chỉ nhận đúng 10 chữ số (inputPhone + editPhone) ──────────
['inputPhone', 'editPhone'].forEach(function(phoneId) {
  const el = document.getElementById(phoneId);
  if (!el) return;
  el.addEventListener('input', function() {
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
    this.classList.remove('error');
    const errEl = document.getElementById(phoneId + 'Error');
    if (errEl) errEl.style.display = 'none';
    this.style.borderColor = '';
  });
  el.addEventListener('keydown', function(e) {
    const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
    if (allowed.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ['a','c','v','x'].includes(e.key.toLowerCase())) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  });
});

// ═══════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════

function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

function hideToast() {
  document.getElementById('toast').classList.remove('show');
  clearTimeout(toastTimer);
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
refreshKhoaBacSiFromApi();
