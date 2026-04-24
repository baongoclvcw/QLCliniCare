(function () {
  function localTodayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function ngayKhamISO(b) {
    if (!b || b.ngay_kham == null) return "";
    return String(b.ngay_kham).split("T")[0].split(" ")[0].trim();
  }

  function minutesFromMidnight() {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }

  function slotMinutesFromBooking(b) {
    const g = displayGio(b);
    if (!g || !/^\d{1,2}:\d{2}/.test(g)) return -1;
    const [h, m] = g.split(":").map(x => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return -1;
    return h * 60 + m;
  }

  /** Còn “sắp tới” theo ngày + giờ trình duyệt */
  function isUpcomingRelativeToNow(b, todayIso) {
    const d = ngayKhamISO(b);
    if (!d) return false;
    if (d > todayIso) return true;
    if (d < todayIso) return false;
    const sm = slotMinutesFromBooking(b);
    if (sm < 0) return true;
    return sm >= minutesFromMidnight();
  }

  function initials(name) {
    if (!name || typeof name !== "string") return "?";
    const parts = name.trim().split(/\s+/);
    const last = parts[parts.length - 1] || "";
    return last.charAt(0).toUpperCase() || "?";
  }

  function formatTimeAgo(iso) {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    const sec = Math.floor((Date.now() - t) / 1000);
    if (sec < 60) return "Vừa xong";
    if (sec < 3600) return Math.floor(sec / 60) + " phút trước";
    if (sec < 86400) return Math.floor(sec / 3600) + " giờ trước";
    return Math.floor(sec / 86400) + " ngày trước";
  }

  function displayGio(b) {
    if (b.gio_kham_hien_thi) return String(b.gio_kham_hien_thi).slice(0, 5);
    const g = b.gio_bat_dau_kham;
    if (!g) return "";
    if (typeof g === "string") return g.slice(0, 5);
    try {
      const d = new Date(g);
      if (!isNaN(d)) {
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
    } catch (_) {}
    return "";
  }

  function statusClass(ma) {
    if (ma === "TT02") return "cancelled";
    if (ma === "TT03") return "completed";
    return "confirmed";
  }

  function statusLabel(ma, ten) {
    if (ma === "TT02") return ten || "Đã hủy";
    if (ma === "TT03") return ten || "Đã khám xong";
    return ten || "Đã xác nhận";
  }

  function setStatCards(s) {
    document.getElementById("statPatientsToday").textContent = String(s.tong_benh_nhan_hom_nay ?? 0);
    document.getElementById("statAppointmentsToday").textContent = String(s.tong_lich_hen_hom_nay ?? 0);
    document.getElementById("statDoctorsToday").textContent = String(s.tong_bac_si_dang_lam ?? 0);
    document.getElementById("statCancelledToday").textContent = String(s.tong_lich_da_huy_hom_nay ?? 0);
  }

  function setStatCardsDash() {
    ["statPatientsToday", "statAppointmentsToday", "statDoctorsToday", "statCancelledToday"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = "—";
    });
  }

  /** Đồng bộ logic quanlylichhenadmin: đếm theo ngày hôm nay từ API bookings */
  async function loadStatsFromBookingsToday(todayIso) {
    const res = await Api.bookings.getAdmin({ pageSize: 5000, page: 1, date: todayIso });
    const raw = res.items || [];
    const items = raw.filter(b => ngayKhamISO(b) === todayIso);
    const patients = new Set();
    items.forEach(b => {
      if (b.ma_tai_khoan) patients.add(b.ma_tai_khoan);
    });
    let c1 = 0,
      c2 = 0,
      c3 = 0;
    items.forEach(b => {
      if (b.ma_trang_thai === "TT01") c1++;
      else if (b.ma_trang_thai === "TT02") c2++;
      else if (b.ma_trang_thai === "TT03") c3++;
    });
    const docSet = new Set();
    items.forEach(b => {
      if (b.ma_bac_si) docSet.add(b.ma_bac_si);
    });
    return {
      tong_benh_nhan_hom_nay: patients.size,
      tong_lich_hen_hom_nay: items.length,
      tong_bac_si_dang_lam: docSet.size,
      tong_lich_da_huy_hom_nay: c2
    };
  }

  async function loadSummaryCards(todayIso) {
    try {
      const s = await Api.stats.summary({ date: todayIso });
      setStatCards(s);
    } catch (e) {
      console.warn("stats.summary fallback bookings", e);
      try {
        const [fromBook, docs] = await Promise.all([
          loadStatsFromBookingsToday(todayIso),
          Api.stats.todayDoctors({ date: todayIso }).catch(() => [])
        ]);
        const nDoc = Array.isArray(docs) ? docs.length : 0;
        if (nDoc > 0) fromBook.tong_bac_si_dang_lam = nDoc;
        setStatCards(fromBook);
      } catch (e2) {
        console.error(e2);
        setStatCardsDash();
      }
    }
  }

  /** Cùng công thức cho cột và nhãn trục Y: v=0 ở đáy plot, v=maxScale ở đỉnh */
  function growthValueToY(v, maxScale, plotTop, plotBottom) {
    const m = Math.max(maxScale, 1);
    return plotBottom - (v / m) * (plotBottom - plotTop);
  }

  /** Tick trục Y: không trùng số; vị trí y khớp scale dữ liệu */
  function growthYAxisTicks(maxRaw, maxScale, plotTop, plotBottom) {
    const vy = val => growthValueToY(val, maxScale, plotTop, plotBottom);
    if (maxRaw <= 0) return [{ v: 0, y: vy(0) }];
    if (maxRaw === 1) {
      return [
        { v: 1, y: vy(1) },
        { v: 0, y: vy(0) }
      ];
    }
    const hi = maxRaw;
    let mid = Math.round(hi / 2);
    if (mid <= 0) mid = 1;
    if (mid >= hi) mid = hi - 1;
    const raw = [
      { v: hi, y: vy(hi) },
      { v: mid, y: vy(mid) },
      { v: 0, y: vy(0) }
    ];
    const seen = new Set();
    return raw.filter(t => {
      if (seen.has(t.v)) return false;
      seen.add(t.v);
      return true;
    });
  }

  async function renderGrowthChartFromApi() {
    const svg = document.querySelector(".chart-svg");
    const hint = document.getElementById("patientChartHint");
    if (!svg) return;
    const now = new Date();
    const y = now.getFullYear();
    const plotTop = 36;
    const plotBottom = 140;
    try {
      const res = await Api.stats.growth({ year: y });
      const points = res && Array.isArray(res.points) ? res.points : [];
      if (hint) {
        hint.textContent = `Năm ${y}: Thống kê số lượng bệnh nhân đã khám xong theo tháng`;
      }
      if (!points.length) {
        svg.innerHTML = `<text x="200" y="80" font-size="12" fill="#9CA3AF" text-anchor="middle" font-family="Inter">Chưa có dữ liệu</text>`;
        return;
      }
      const counts = points.map(p => parseInt(p.count, 10) || 0);
      const maxRaw = Math.max(...counts, 0);
      const maxScale = Math.max(maxRaw, 1);
      const x0 = 52;
      const x1 = 368;
      const n = counts.length;
      const slot = n <= 1 ? 0 : (x1 - x0) / (n - 1);
      const barW = Math.min(26, n <= 1 ? 32 : slot * 0.55);

      const yTicks = growthYAxisTicks(maxRaw, maxScale, plotTop, plotBottom);
      const yAxisSvg = yTicks
        .map(
          t =>
            `<text x="34" y="${t.y + 3}" font-size="10" fill="#9CA3AF" text-anchor="end" font-family="Inter">${t.v}</text>`
        )
        .join("");
      const hGuide = yTicks
        .map(
          t =>
            `<line x1="42" y1="${t.y}" x2="380" y2="${t.y}" stroke="#F3F4F6" stroke-width="1"/>`
        )
        .join("");

      const barsAndLabels = counts
        .map((c, i) => {
          const cx = n <= 1 ? (x0 + x1) / 2 : x0 + i * slot;
          const topY = growthValueToY(c, maxScale, plotTop, plotBottom);
          const h = Math.max(plotBottom - topY, 0);
          const bx = cx - barW / 2;
          const lab = String(points[i].label || `T${i + 1}`).trim();
          const valY = h < 1 ? plotBottom - 11 : topY - 4;
          const barSvg = `<rect x="${bx}" y="${topY}" width="${barW}" height="${h}" fill="#2F56C0" rx="3" opacity="0.92"/>`;
          const numSvg = `<text x="${cx}" y="${valY}" font-size="10" fill="#1F2937" text-anchor="middle" font-family="Inter" font-weight="600">${c}</text>`;
          const monthSvg = `<text x="${cx}" y="162" font-size="8" fill="#6B7280" text-anchor="middle" font-family="Inter">${escapeHtml(lab)}</text>`;
          return barSvg + numSvg + monthSvg;
        })
        .join("");

      svg.innerHTML = `
        <line x1="40" y1="${plotTop}" x2="40" y2="${plotBottom}" stroke="#E5E7EB" stroke-width="1"/>
        <line x1="40" y1="${plotBottom}" x2="380" y2="${plotBottom}" stroke="#E5E7EB" stroke-width="1"/>
        ${hGuide}
        ${yAxisSvg}
        ${barsAndLabels}
      `;
    } catch (e) {
      console.error(e);
      svg.innerHTML = `<text x="200" y="80" font-size="11" fill="#b91c1c" text-anchor="middle" font-family="Inter">Không tải được biểu đồ</text>`;
    }
  }

  async function loadUpcomingList(todayIso) {
    const upEl = document.getElementById("upcomingAppointmentsList");
    if (!upEl) return;
    try {
      const up = await Api.stats.upcomingBookings({ date: todayIso, pageSize: 80 });
      const raw = up.items || [];
      const items = raw.filter(b => isUpcomingRelativeToNow(b, todayIso)).slice(0, 12);
      upEl.innerHTML = "";
      if (!items.length) {
        upEl.innerHTML =
          '<div class="appointment-item" style="justify-content:center;color:#6b7280;">Không có lịch sắp tới</div>';
        return;
      }
      items.forEach(b => {
        const gio = displayGio(b);
        const pn = patientName(b.ho_ten);
        const row = document.createElement("div");
        row.className = "appointment-item";
        row.innerHTML = `
            <div class="appointment-avatar" style="background:#3B82F6;">${initials(pn || "?")}</div>
            <div class="appointment-info">
              <div class="appointment-name">${
                pn
                  ? escapeHtml(pn)
                  : '<span style="color:#9ca3af;font-weight:500">Chưa có trong hồ sơ</span>'
              }</div>
              <div class="appointment-details">${formatDMYShort(b.ngay_kham)} ${gio ? "• " + escapeHtml(gio) : ""} • ${escapeHtml(
          b.ho_ten_bac_si || ""
        )}</div>
            </div>
            <div class="appointment-status ${statusClass(b.ma_trang_thai)}">${escapeHtml(
          statusLabel(b.ma_trang_thai, b.ten_trang_thai)
        )}</div>
          `;
        upEl.appendChild(row);
      });
    } catch (e) {
      console.error(e);
      upEl.innerHTML =
        '<div class="appointment-item" style="justify-content:center;color:#b91c1c;">Không tải được lịch</div>';
    }
  }

  function formatDMYShort(ngay) {
    const s = ngayKhamISO(ngay);
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }

  async function loadTodayDoctors(todayParam) {
    const docEl = document.getElementById("todayDoctorsList");
    if (!docEl) return;
    try {
      const doctors = await Api.stats.todayDoctors(todayParam);
      const list = Array.isArray(doctors) ? doctors : [];
      docEl.innerHTML = "";
      if (!list.length) {
        docEl.innerHTML =
          '<div class="doctor-item" style="justify-content:center;color:#6b7280;">Không có bác sĩ trực hôm nay</div>';
        return;
      }
      list.forEach(d => {
        const row = document.createElement("div");
        row.className = "doctor-item";
        row.innerHTML = `
            <div class="doctor-avatar" style="background:#2F56C0;">${initials(d.ho_ten_bac_si)}</div>
            <div class="doctor-info">
              <div class="doctor-name">${escapeHtml(d.ho_ten_bac_si || "")}</div>
              <div class="doctor-specialty">${escapeHtml(d.ten_khoa || "")}</div>
            </div>
            <div class="doctor-status active"></div>
          `;
        docEl.appendChild(row);
      });
    } catch (e) {
      console.error(e);
      docEl.innerHTML =
        '<div class="doctor-item" style="justify-content:center;color:#b91c1c;">Không tải được danh sách</div>';
    }
  }

  function activityStroke(type) {
    if (type === "success") return "#10B981";
    if (type === "warning") return "#F59E0B";
    return "#3B82F6";
  }

  async function loadActivities() {
    const actEl = document.getElementById("adminActivityList");
    if (!actEl) return;
    try {
      const logs = await Api.stats.activities();
      actEl.innerHTML = "";
      if (!logs.length) {
        actEl.innerHTML =
          '<div class="activity-item" style="justify-content:center;color:#6b7280;">Chưa có hoạt động</div>';
        return;
      }
      logs.forEach(log => {
        const row = document.createElement("div");
        row.className = "activity-item";
        const stroke = activityStroke(log.type);
        row.innerHTML = `
            <div class="activity-icon" style="background: rgba(59, 130, 246, 0.1);">
              <svg fill="none" stroke="${stroke}" viewBox="0 0 24 24" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6" stroke-linecap="round"></line>
                <line x1="8" y1="2" x2="8" y2="6" stroke-linecap="round"></line>
                <line x1="3" y1="10" x2="21" y2="10" stroke-linecap="round"></line>
              </svg>
            </div>
            <div class="activity-info">
              <div class="activity-text">${escapeHtml(log.message || "")}</div>
              <div class="activity-time">${escapeHtml(formatTimeAgo(log.time))}</div>
            </div>
          `;
        actEl.appendChild(row);
      });
    } catch (e) {
      console.error(e);
      actEl.innerHTML =
        '<div class="activity-item" style="justify-content:center;color:#b91c1c;">Không tải được hoạt động</div>';
    }
  }

  async function refreshDashboard() {
    const todayIso = localTodayISO();
    const todayParam = { date: todayIso };
    await loadSummaryCards(todayIso);
    await loadUpcomingList(todayIso);
    await loadTodayDoctors(todayParam);
    await loadActivities();
    await renderGrowthChartFromApi();
  }

  document.addEventListener("DOMContentLoaded", () => {
    refreshDashboard();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshDashboard();
    });
    window.addEventListener("pageshow", ev => {
      if (ev.persisted) refreshDashboard();
    });
  });

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function patientName(hoTen) {
    if (hoTen == null) return "";
    const t = String(hoTen).trim();
    return t || "";
  }
})();
