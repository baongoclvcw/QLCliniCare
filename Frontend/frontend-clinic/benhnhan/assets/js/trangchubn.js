(function () {
  const DEPT_STYLES = [
    { bg: "rgba(239, 68, 68, 0.08)", stroke: "#EF4444" },
    { bg: "rgba(245, 158, 11, 0.08)", stroke: "#F59E0B" },
    { bg: "rgba(16, 185, 129, 0.08)", stroke: "#10B981" },
    { bg: "rgba(139, 92, 246, 0.08)", stroke: "#8B5CF6" },
    { bg: "rgba(59, 130, 246, 0.08)", stroke: "#3B82F6" },
    { bg: "rgba(236, 72, 153, 0.08)", stroke: "#EC4899" }
  ];

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function doctorInitials(name) {
    if (!name) return "?";
    const parts = String(name).trim().split(/\s+/);
    const last = parts[parts.length - 1] || "";
    return last.charAt(0).toUpperCase() || "?";
  }

  /** Icon theo tên khoa (chuỗi tiếng Việt, không trùng lặp nhiều) */
  function departmentIconSvg(tenKhoa, stroke) {
    const t = String(tenKhoa || "").toLowerCase();
    const w = 22;
    const h = 22;
    const S = `stroke="${stroke}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    if (/tim mạch|tim mach|cardio|tim\b/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><path ${S} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/><path ${S} d="M3 12h4l2-3 4 6 2-3h6"/></svg>`;
    }
    if (/da liễu|da lieu|dermat/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><circle cx="12" cy="12" r="3" ${S}/><path ${S} d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M16.66 6.34l1.41-1.41"/></svg>`;
    }
    if (/\bnhi\b|nhi khoa|trẻ em|tre em|pediat/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><circle cx="9" cy="7" r="3" ${S}/><circle cx="17" cy="9" r="2.5" ${S}/><path ${S} d="M9 11c-2.5 0-4.5 2-5 5h8m4-1h2c.5-2.5 2-4 4-4"/></svg>`;
    }
    if (/xương|xuong|khớp|khop|ortho|cơ xương khớp/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><path ${S} d="M12 4v16M8 8h8M8 16h8M6 12h12"/><circle cx="12" cy="6" r="2" ${S}/><circle cx="12" cy="18" r="2" ${S}/></svg>`;
    }
    if (/tai mũi họng|tai mui hong|tmh|ent/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><path ${S} d="M6 9a4 4 0 018 0v5a2 2 0 01-2 2h-1"/><path ${S} d="M10 18a2 2 0 104 0"/><path ${S} d="M14 9V7a2 2 0 10-4 0v2"/></svg>`;
    }
    if (/mắt|mat\b|nhãn khoa|nhan khoa|ophthal/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><path ${S} d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3" ${S}/></svg>`;
    }
    if (/thần kinh|than kinh|não|nao|neuro/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><path ${S} d="M12 5a3 3 0 103 3M9 8a3 3 0 10-3 3"/><path ${S} d="M12 11v3m-2 5h4"/><path ${S} d="M9 16l-1 3m7-3l1 3"/></svg>`;
    }
    if (/sản|san\b|phụ khoa|phu khoa|thai|obstet|sản khoa/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><path ${S} d="M12 11c-2 0-4 1.5-4 4v2h8v-2c0-2.5-2-4-4-4z"/><circle cx="12" cy="7" r="3" ${S}/><path ${S} d="M8 21h8"/><circle cx="17" cy="10" r="2" ${S}/></svg>`;
    }
    if (/tiêu hóa|tieu hoa|dạ dày|da day|gastro/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><ellipse cx="12" cy="12" rx="7" ry="9" ${S}/><path ${S} d="M9 8c2 2 4 2 6 0M9 16c2-2 4-2 6 0"/></svg>`;
    }
    if (/nội tiết|noi tiet|endocrin/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><path ${S} d="M12 3v4"/><path ${S} d="M12 17v4"/><path ${S} d="M5.6 5.6l2.8 2.8"/><path ${S} d="M15.6 15.6l2.8 2.8"/><path ${S} d="M3 12h4"/><path ${S} d="M17 12h4"/><circle cx="12" cy="12" r="4" ${S}/></svg>`;
    }
    if (/ngoại|ngoai|phẫu thuật|phau thuat|surgery/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><path ${S} d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`;
    }
    if (/nội tổng|noi tong|nội khoa|noi khoa|internal/.test(t)) {
      return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><path ${S} d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" width="${w}" height="${h}"><path ${S} d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/><path ${S} d="M12 8v8M8 12h8"/></svg>`;
  }

  async function loadFeatured() {
    const grid = document.getElementById("featuredDoctorsGrid");
    if (!grid) return;
    try {
      const list = await Api.doctors.getAll({ featured: "true" });
      let arr = Array.isArray(list) ? list : [];
      arr = arr.slice(0, 4);
      grid.innerHTML = "";
      if (!arr.length) {
        grid.innerHTML =
          '<p style="grid-column:1/-1;text-align:center;color:#6b7280;">Chưa có dữ liệu bác sĩ nổi bật.</p>';
        return;
      }
      arr.forEach(d => {
        const card = document.createElement("div");
        card.className = "doctor-card";
        const spec = d.chuyen_khoa || d.ten_khoa || "";
        card.innerHTML = `
          <div class="doctor-avatar">${escapeHtml(doctorInitials(d.ho_ten_bac_si))}</div>
          <div class="doctor-info">
            <div class="doctor-name">${escapeHtml(d.ho_ten_bac_si || "")}</div>
            <div class="doctor-specialty">${escapeHtml(spec)}</div>
          </div>
          <button type="button" class="doctor-btn">Đặt lịch</button>
        `;
        card.querySelector(".doctor-btn").addEventListener("click", () => {
          window.location.href =
            "datlich2.html?doctor=" + encodeURIComponent(d.ma_bac_si || "");
        });
        grid.appendChild(card);
      });
    } catch (e) {
      console.error(e);
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;color:#b91c1c;">Không tải được danh sách bác sĩ.</p>';
    }
  }

  async function loadDepartments() {
    const grid = document.getElementById("departmentsGrid");
    if (!grid) return;
    try {
      const depts = await Api.departments.getAll();
      grid.innerHTML = "";
      if (!depts.length) {
        grid.innerHTML =
          '<p style="grid-column:1/-1;text-align:center;color:#6b7280;">Chưa có dữ liệu khoa.</p>';
        return;
      }
      depts.forEach((k, i) => {
        const st = DEPT_STYLES[i % DEPT_STYLES.length];
        const card = document.createElement("div");
        card.className = "department-card";
        card.innerHTML = `
          <div class="department-icon" style="background:${st.bg};">${departmentIconSvg(k.ten_khoa, st.stroke)}</div>
          <div class="department-name">${escapeHtml(k.ten_khoa || "")}</div>
        `;
        card.addEventListener("click", () => {
          const mk = k.ma_khoa != null ? String(k.ma_khoa).trim() : "";
          const q = mk ? `?ma_khoa=${encodeURIComponent(mk)}` : "";
          window.location.href = "dskhoa.html" + q;
        });
        grid.appendChild(card);
      });
    } catch (e) {
      console.error(e);
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;color:#b91c1c;">Không tải được chuyên khoa.</p>';
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadFeatured();
    loadDepartments();
  });
})();
