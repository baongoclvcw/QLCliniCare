(function () {
  let bookingId = null;
  let bookingDetail = null;

  let selectedTime = "09:00";
  let selectedDate = new Date();
  let dateConfirmed = true;
  let calViewYear = selectedDate.getFullYear();
  let calViewMonth = selectedDate.getMonth();

  function setError(fieldId, errId, show) {
    const field = document.getElementById(fieldId);
    const err = document.getElementById(errId);
    if (!field || !err) return;
    if (show) {
      field.classList.add("input-error");
      err.classList.add("show");
    } else {
      field.classList.remove("input-error");
      err.classList.remove("show");
    }
  }

  window.onDepartmentChange = async function (sel) {
    const maKhoa = sel.value;
    const doctorSel = document.getElementById("doctor");
    doctorSel.innerHTML = '<option value="">-- Chọn bác sĩ --</option>';
    if (!maKhoa) {
      doctorSel.disabled = true;
      return;
    }
    doctorSel.disabled = false;
    try {
      const res = await Api.doctors.getAll({ ma_khoa: maKhoa });
      const items = res.items || [];
      items.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.ma_bac_si;
        opt.textContent = d.ho_ten_bac_si;
        doctorSel.appendChild(opt);
      });
    } catch (e) {
      console.error(e);
    }
  };

  async function loadDoctorsAndSelect(maKhoa, maBacSi) {
    const deptSel = document.getElementById("department");
    deptSel.value = maKhoa || "";
    await window.onDepartmentChange(deptSel);
    const doctorSel = document.getElementById("doctor");
    if (maBacSi) doctorSel.value = maBacSi;
  }

  function formatDobDisplay(ngay) {
    if (!ngay) return "";
    const s = String(ngay).split("T")[0];
    const p = s.split("-");
    if (p.length !== 3) return String(ngay);
    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  function strOrEmpty(v) {
    if (v == null) return "";
    const s = String(v).trim();
    return s;
  }

  function parseIsoDate(s) {
    if (!s) return new Date();
    const p = String(s).split("T")[0].split("-");
    if (p.length !== 3) return new Date();
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  function syncDateUi() {
    const d = selectedDate;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const y = d.getFullYear();
    document.getElementById("dateText").textContent = `${dd}/${mm}/${y}`;
    document.getElementById("appointmentDate").value = `${y}-${mm}-${dd}`;
    calViewYear = y;
    calViewMonth = d.getMonth();
  }

  function selectTimeSlot(timeStr) {
    selectedTime = timeStr;
    document.getElementById("appointmentTime").value = timeStr;
    document.querySelectorAll(".time-slot").forEach(b => {
      b.classList.toggle("selected", b.dataset.time === timeStr);
    });
  }

  window.toggleCalendar = function () {
    const cal = document.getElementById("calendarEl");
    if (cal.classList.contains("open")) {
      cal.classList.remove("open");
    } else {
      buildCalendar();
      cal.classList.add("open");
    }
  };

  function buildCalendar() {
    const cal = document.getElementById("calendarEl");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDay = new Date(calViewYear, calViewMonth, 1);
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    const monthNames = [
      "Tháng 1",
      "Tháng 2",
      "Tháng 3",
      "Tháng 4",
      "Tháng 5",
      "Tháng 6",
      "Tháng 7",
      "Tháng 8",
      "Tháng 9",
      "Tháng 10",
      "Tháng 11",
      "Tháng 12"
    ];

    let startDow = firstDay.getDay();

    let html = `
      <div class="cal-header">
        <button type="button" onclick="prevMonth(event)">&#8249;</button>
        <span class="cal-month-year">${monthNames[calViewMonth]} ${calViewYear}</span>
        <button type="button" onclick="nextMonth(event)">&#8250;</button>
      </div>
      <div class="cal-weekdays">
        <span>CN</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span>
      </div>
      <div class="cal-days">`;

    for (let i = 0; i < startDow; i++) {
      html += `<button type="button" class="cal-day empty" disabled></button>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(calViewYear, calViewMonth, d);
      const dow = date.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isPast = date < today;
      const isToday = date.getTime() === today.getTime();
      const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
      let cls = "cal-day";
      if (isWeekend || isPast) cls += " weekend";
      if (isToday) cls += " today";
      if (isSelected) cls += " selected";
      const disabled = isWeekend || isPast ? "disabled" : "";
      html += `<button type="button" class="${cls}" ${disabled} onclick="selectDay(${d}, event)">${d}</button>`;
    }

    html += `</div>`;
    cal.innerHTML = html;
  }

  window.prevMonth = function (e) {
    e.stopPropagation();
    calViewMonth--;
    if (calViewMonth < 0) {
      calViewMonth = 11;
      calViewYear--;
    }
    buildCalendar();
  };

  window.nextMonth = function (e) {
    e.stopPropagation();
    calViewMonth++;
    if (calViewMonth > 11) {
      calViewMonth = 0;
      calViewYear++;
    }
    buildCalendar();
  };

  window.selectDay = function (d, e) {
    e.stopPropagation();
    selectedDate = new Date(calViewYear, calViewMonth, d);
    dateConfirmed = false;

    const dd = String(d).padStart(2, "0");
    const mm = String(calViewMonth + 1).padStart(2, "0");
    document.getElementById("dateText").textContent = `${dd}/${mm}/${calViewYear}`;
    document.getElementById("appointmentDate").value = `${calViewYear}-${mm}-${dd}`;

    const btn = document.getElementById("confirmDateBtn");
    btn.disabled = false;
    btn.classList.remove("confirmed");
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Xác nhận`;

    document.getElementById("timeSlotSection").style.display = "";

    buildCalendar();
    document.getElementById("calendarEl").classList.remove("open");
  };

  window.confirmDate = function () {
    dateConfirmed = true;
    const btn = document.getElementById("confirmDateBtn");
    btn.classList.add("confirmed");
    btn.disabled = true;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Đã xác nhận`;
  };

  window.selectTime = function (el) {
    document.querySelectorAll(".time-slot").forEach(b => b.classList.remove("selected"));
    el.classList.add("selected");
    selectedTime = el.dataset.time;
    document.getElementById("appointmentTime").value = selectedTime;
  };

  window.handleSave = async function () {
    let valid = true;
    const dept = document.getElementById("department").value;
    if (!dept) {
      setError("department", "err-department", true);
      valid = false;
    } else setError("department", "err-department", false);

    const doctor = document.getElementById("doctor").value;
    if (!doctor) {
      alert("Vui lòng chọn bác sĩ.");
      valid = false;
    }

    const description = document.getElementById("description").value.trim();
    if (!description) {
      setError("description", "err-description", true);
      valid = false;
    } else setError("description", "err-description", false);

    if (!dateConfirmed) {
      alert("Vui lòng chọn ngày khám và bấm Xác nhận.");
      valid = false;
    }

    if (!valid) return;

    const ngay_kham = document.getElementById("appointmentDate").value;
    const gio_bat_dau_kham = document.getElementById("appointmentTime").value;

    try {
      await Api.bookings.update(bookingId, {
        ngay_kham,
        gio_bat_dau_kham,
        ma_bac_si: doctor,
        mo_ta_trieu_chung: description
      });
      sessionStorage.setItem("adminBookingToast", "Đã lưu thay đổi lịch hẹn.");
      window.location.href = "quanlylichhenadmin.html";
    } catch (e) {
      alert(e.message || "Lưu thất bại");
    }
  };

  document.addEventListener("click", function (e) {
    const wrapper = document.getElementById("dateWrapper");
    if (wrapper && !wrapper.contains(e.target)) {
      document.getElementById("calendarEl").classList.remove("open");
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    bookingId = sessionStorage.getItem("adminBookingId");
    if (!bookingId) {
      window.location.href = "quanlylichhenadmin.html";
      return;
    }

    document.getElementById("department").addEventListener("change", function () {
      if (this.value) setError("department", "err-department", false);
    });
    document.getElementById("description").addEventListener("input", function () {
      if (this.value.trim()) setError("description", "err-description", false);
    });

    try {
      bookingDetail = await Api.bookings.getById(bookingId);
      const ma = bookingDetail.ma_trang_thai;
      if (ma === "TT02" || ma === "TT03") {
        alert("Lịch này không thể chỉnh sửa.");
        window.location.href = "xemchitietlichhenadmin.html";
        return;
      }

      document.getElementById("patName").value = strOrEmpty(bookingDetail.benh_nhan);
      const ph = bookingDetail.so_dien_thoai != null ? String(bookingDetail.so_dien_thoai).trim() : "";
      document.getElementById("patPhone").value = ph;
      document.getElementById("patGender").value = bookingDetail.gioi_tinh ? String(bookingDetail.gioi_tinh).trim() : "";
      document.getElementById("patDob").value = formatDobDisplay(bookingDetail.ngay_sinh);

      const depts = await Api.departments.getAll();
      const deptSel = document.getElementById("department");
      deptSel.innerHTML = '<option value="">Chọn khoa</option>';
      depts.forEach(k => {
        const opt = document.createElement("option");
        opt.value = k.ma_khoa;
        opt.textContent = k.ten_khoa;
        deptSel.appendChild(opt);
      });

      await loadDoctorsAndSelect(bookingDetail.ma_khoa, bookingDetail.ma_bac_si);

      selectedDate = parseIsoDate(bookingDetail.ngay_kham);
      syncDateUi();
      window.confirmDate();

      const gio = bookingDetail.gio_bat_dau_kham
        ? String(bookingDetail.gio_bat_dau_kham).slice(0, 5)
        : "09:00";
      const slotBtn = document.querySelector(`.time-slot[data-time="${gio}"]`);
      if (slotBtn) window.selectTime(slotBtn);
      else selectTimeSlot(gio);

      document.getElementById("description").value = bookingDetail.mo_ta_trieu_chung || "";
    } catch (e) {
      alert(e.message || "Không tải được dữ liệu");
      window.location.href = "quanlylichhenadmin.html";
    }
  });
})();
