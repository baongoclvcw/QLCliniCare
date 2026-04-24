(function () {
  let currentPage = 1;
  const pageSize = 10;

  function localTodayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function statusFilterToApi(val) {
    const m = { confirmed: "TT01", cancelled: "TT02", completed: "TT03" };
    return m[val] || "";
  }


  function mapBadge(ma, ten) {
    if (ma === "TT02") return { cls: "status-cancelled", text: ten || "Đã hủy" };
    if (ma === "TT03") return { cls: "status-completed", text: ten || "Đã khám xong" };
    if (ma === "TT04") return { cls: "status-pending", text: ten || "Chờ xác nhận" };
    return { cls: "status-confirmed", text: ten || "Đã xác nhận" };
  }

  function formatDateDMY(ngay) {
    if (!ngay) return "—";
    const s = String(ngay).split("T")[0];
    const p = s.split("-");
    if (p.length !== 3) return s;
    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  function displayGio(b) {
    if (b.gio_kham_hien_thi) return String(b.gio_kham_hien_thi).slice(0, 5);
    const g = b.gio_bat_dau_kham;
    if (!g) return "—";
    if (typeof g === "string" && /^\d{1,2}:\d{2}/.test(g)) return g.slice(0, 5);
    try {
      const d = new Date(g);
      if (!isNaN(d)) {
        const h = String(d.getHours()).padStart(2, "0");
        const m = String(d.getMinutes()).padStart(2, "0");
        return `${h}:${m}`;
      }
    } catch (_) {}
    return "—";
  }

  function ngayKhamISO(b) {
    if (!b || b.ngay_kham == null) return "";
    return String(b.ngay_kham).split("T")[0].split(" ")[0].trim();
  }

  /** Họ tên bệnh nhân hợp lệ (API cũng đã lọc; giữ lớp phòng thủ phía FE) */
  function hasValidPatientName(b) {
    if (!b || b.ho_ten == null) return false;
    const n = String(b.ho_ten).trim();
    if (!n) return false;
    if (n === "—" || n === "Chưa có trong hồ sơ") return false;
    return true;
  }

  /** 4 thẻ thống kê: luôn theo ngày hôm nay (local), không dùng search/status/date filter của bảng */
  async function loadStatsToday() {
    const today = localTodayISO();
    try {
      const res = await Api.bookings.getAdmin({
        pageSize: 5000,
        page: 1,
        date: today
      });
      const raw = res.items || [];
      const items = raw.filter(b => ngayKhamISO(b) === today && hasValidPatientName(b));
      let c1 = 0,
        c2 = 0,
        c3 = 0;
      items.forEach(b => {
        if (b.ma_trang_thai === "TT01") c1++;
        else if (b.ma_trang_thai === "TT02") c2++;
        else if (b.ma_trang_thai === "TT03") c3++;
      });
      document.getElementById("statTotal").textContent = String(items.length);
      document.getElementById("statConfirmed").textContent = String(c1);
      document.getElementById("statCancelled").textContent = String(c2);
      document.getElementById("statCompleted").textContent = String(c3);
    } catch (e) {
      console.error(e);
    }
  }

  function renderPagination(totalItems) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const wrap = document.getElementById("paginationButtons");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (totalPages <= 1) {
      wrap.style.display = "none";
      return;
    }
    wrap.style.display = "";

    const prev = document.createElement("button");
    prev.className = "pagination-btn";
    prev.textContent = "Trước";
    prev.disabled = currentPage <= 1;
    prev.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        loadTable();
      }
    });
    wrap.appendChild(prev);

    const maxBtns = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxBtns - 1);
    start = Math.max(1, end - maxBtns + 1);
    for (let p = start; p <= end; p++) {
      const btn = document.createElement("button");
      btn.className = "pagination-btn" + (p === currentPage ? " active" : "");
      btn.textContent = String(p);
      btn.addEventListener("click", () => {
        currentPage = p;
        loadTable();
      });
      wrap.appendChild(btn);
    }

    const next = document.createElement("button");
    next.className = "pagination-btn";
    next.textContent = "Sau";
    next.disabled = currentPage >= totalPages;
    next.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        loadTable();
      }
    });
    wrap.appendChild(next);
  }

  async function loadTable() {
    const search = document.getElementById("filterName").value.trim();
    const status = statusFilterToApi(document.getElementById("filterStatus").value);
    const date = document.getElementById("filterDate").value;
    const params = {
      page: currentPage,
      pageSize,
      search: search || undefined,
      status: status || undefined,
      date: date || undefined
    };
    try {
      const res = await Api.bookings.getAdmin(params);
      const items = (res.items || []).filter(hasValidPatientName);
      const totalItems = res.totalItems != null ? res.totalItems : items.length;
      const tbody = document.getElementById("appointmentsTableBody");
      tbody.innerHTML = "";

      const offset = (currentPage - 1) * pageSize;
      items.forEach((b, i) => {
        const { cls, text } = mapBadge(b.ma_trang_thai, b.ten_trang_thai);
        const tr = document.createElement("tr");
        tr.dataset.id = b.ma_lich_hen;
        tr.dataset.statusCode = b.ma_trang_thai;
        tr.innerHTML = `
          <td>${offset + i + 1}</td>
          <td>${b.ma_lich_hen}</td>
          <td class="patient-name">${escapeHtml(String(b.ho_ten).trim())}</td>
          <td>${escapeHtml((b.ho_ten_bac_si && String(b.ho_ten_bac_si).trim()) || "")}</td>
          <td>${escapeHtml((b.ten_khoa && String(b.ten_khoa).trim()) || "")}</td>
          <td>${formatDateDMY(b.ngay_kham)}</td>
          <td>${displayGio(b)}</td>
          <td><span class="status-badge ${cls}">${escapeHtml(text)}</span></td>
        `;
        tr.addEventListener("click", () => {
          sessionStorage.setItem("adminBookingId", b.ma_lich_hen);
          sessionStorage.setItem("currentViewStatus", text);
          window.location.href = "xemchitietlichhenadmin.html";
        });
        tbody.appendChild(tr);
      });

      const from = totalItems === 0 ? 0 : offset + 1;
      const to = offset + items.length;
      document.querySelector("#paginationInfo span:first-child").textContent =
        totalItems === 0 ? "0" : `${from}-${to}`;
      document.querySelector("#paginationInfo span:last-child").textContent = String(totalItems);

      renderPagination(totalItems);
      await loadStatsToday();
    } catch (e) {
      console.error(e);
      document.getElementById("appointmentsTableBody").innerHTML =
        `<tr><td colspan="8" style="text-align:center;padding:24px;color:#b91c1c;">${escapeHtml(
          e.message || "Không tải được danh sách"
        )}</td></tr>`;
      await loadStatsToday();
    }
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function applyFilters() {
    currentPage = 1;
    loadTable();
  }

  function wireFilters() {
    let t;
    document.getElementById("filterName").addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(applyFilters, 350);
    });
    document.getElementById("filterStatus").addEventListener("change", applyFilters);
    document.getElementById("filterDate").addEventListener("change", applyFilters);
  }

  function showReturnToast() {
    const msg = sessionStorage.getItem("adminBookingToast");
    if (!msg) return;
    sessionStorage.removeItem("adminBookingToast");
    const toast = document.getElementById("toastEl");
    document.getElementById("toastMsg").textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireFilters();
    loadTable();
    showReturnToast();
  });
})();
