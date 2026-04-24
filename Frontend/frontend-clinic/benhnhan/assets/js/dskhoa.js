document.addEventListener("DOMContentLoaded", () => {
  const deptGrid = document.querySelector(".dept-grid");
  const modal = document.getElementById("doctorModal");
  const drGrid = document.getElementById("doctorGrid");
  const modalDeptName = document.getElementById("modalDeptName");
  const profileModal = document.getElementById("doctorProfileModal");

  let departments = [];
  let doctorsByDept = {};

  function deptKey(ma) {
    const s = ma == null ? "" : String(ma).trim();
    return s || "_";
  }

  function groupDoctors(items) {
    const map = {};
    (items || []).forEach(d => {
      const k = deptKey(d.ma_khoa);
      if (!map[k]) map[k] = [];
      map[k].push(d);
    });
    return map;
  }

  async function loadData() {
    try {
      departments = await Api.departments.getAll();
      const res = await Api.doctors.getAll();
      const items = res.items || [];
      doctorsByDept = groupDoctors(items);
      renderDepartments(departments);
      const wantRaw = new URLSearchParams(location.search).get("ma_khoa");
      const want = wantRaw != null ? String(wantRaw).trim() : "";
      if (want) {
        const dept = departments.find(d => deptKey(d.ma_khoa) === want);
        if (dept) {
          const list = doctorsByDept[deptKey(dept.ma_khoa)] || [];
          openDoctorModal(dept, list);
        }
      }
    } catch (e) {
      console.error(e);
      if (deptGrid) {
        deptGrid.innerHTML = `<p style="padding:24px;color:#b91c1c;">Không tải được dữ liệu. Hãy chạy backend và kiểm tra CORS/API.<br><small>${e.message}</small></p>`;
      }
    }
  }

  function renderDepartments(data) {
    if (!deptGrid) return;
    deptGrid.innerHTML = "";
    data.forEach(dept => {
      const list = doctorsByDept[deptKey(dept.ma_khoa)] || [];
      const card = document.createElement("div");
      card.className = "dept-card";
      card.innerHTML = `
        <div class="dept-name">${(dept.ten_khoa || "").toUpperCase()}</div>
        <div class="dept-info">Trưởng khoa: ${dept.truong_khoa || "—"}</div>
        <div class="dept-info">Đội ngũ: ${list.length} bác sĩ</div>
      `;
      card.addEventListener("click", () => openDoctorModal(dept, list));
      deptGrid.appendChild(card);
    });
  }

  function openDoctorModal(dept, doctorsList) {
    modalDeptName.innerText = dept.ten_khoa || "";
    if (!doctorsList.length) {
      drGrid.innerHTML = "<p style=\"padding:16px;\">Chưa có bác sĩ cho khoa này.</p>";
    } else {
      drGrid.innerHTML = doctorsList
        .map(
          dr => `
        <div class="patient-dr-card">
          <div class="dr-avatar-circle"><i class="fa-solid fa-user-doctor"></i></div>
          <div class="dr-name-text">${dr.ho_ten_bac_si || ""}</div>
          <div class="dr-position-text">${dr.chuc_danh || "Bác sĩ"}</div>
          <button type="button" class="btn-book" data-ma-bs="${dr.ma_bac_si}">Xem chi tiết</button>
        </div>
      `
        )
        .join("");
      drGrid.querySelectorAll(".btn-book").forEach(btn => {
        btn.addEventListener("click", ev => {
          ev.stopPropagation();
          showDrDetail(btn.getAttribute("data-ma-bs"));
        });
      });
    }
    modal.style.display = "flex";
  }

  function fmtDate(d) {
    if (!d) return "—";
    const s = String(d).split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, dd] = s.split("-");
      return `${dd}/${m}/${y}`;
    }
    return d;
  }

  window.showDrDetail = async function (maBacSi) {
    try {
      const dr = await Api.doctors.getById(maBacSi, { role: "patient" });
      document.getElementById("p-name").innerText = dr.ho_ten_bac_si || "";
      document.getElementById("p-rank").innerText = dr.chuc_danh || "";
      document.getElementById("p-dob").innerText = fmtDate(dr.ngay_sinh);
      document.getElementById("p-gender").innerText = dr.gioi_tinh || "—";
      document.getElementById("p-exp").innerText =
        dr.so_nam_kinh_nghiem != null ? `${dr.so_nam_kinh_nghiem} năm` : "—";
      document.getElementById("p-spec").innerText = dr.chuyen_khoa || dr.ten_khoa || "—";
      document.getElementById("p-desc").innerText = dr.mo_ta_kinh_nghiem || "—";

      const wh = dr.gio_lam_viec;
      let scheduleHtml = "<p style=\"color:#64748b;\">Chưa có cấu hình giờ làm.</p>";
      if (wh && (wh.sang_bd || wh.chieu_bd)) {
        scheduleHtml = `
          <div style="background:#f8fafc;padding:15px;border-radius:12px;border:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
            <i class="fa-regular fa-clock" style="color:#3152B8;font-size:18px;"></i>
            <div>
              <span style="display:block;font-weight:700;color:#1e293b;">Ca sáng: ${wh.sang_bd || "—"} – ${wh.sang_kt || "—"}</span>
              <span style="color:#64748b;font-size:13px;">Ca chiều: ${wh.chieu_bd || "—"} – ${wh.chieu_kt || "—"}</span>
            </div>
          </div>`;
      }
      document.getElementById("p-schedule").innerHTML = scheduleHtml;

      const bookBtn = profileModal.querySelector(".btn-book");
      if (bookBtn) {
        bookBtn.onclick = () => {
          window.location.href = `datlich2.html?doctor=${encodeURIComponent(maBacSi)}`;
        };
      }

      profileModal.style.display = "flex";
    } catch (e) {
      alert(e.message || "Không tải được hồ sơ bác sĩ");
    }
  };

  const closeMainModal = document.querySelector(".close-modal");
  if (closeMainModal) {
    closeMainModal.onclick = () => {
      modal.style.display = "none";
    };
  }

  const closeProfileModal = document.querySelector(".close-profile");
  if (closeProfileModal) {
    closeProfileModal.onclick = () => {
      profileModal.style.display = "none";
    };
  }

  window.onclick = event => {
    if (event.target === profileModal) profileModal.style.display = "none";
    else if (event.target === modal) modal.style.display = "none";
  };

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      const term = e.target.value.toLowerCase().trim();
      if (!term) {
        renderDepartments(departments);
        return;
      }
      const filtered = departments.filter(d => {
        const name = (d.ten_khoa || "").toLowerCase();
        const head = (d.truong_khoa || "").toLowerCase();
        const docs = doctorsByDept[d.ma_khoa] || [];
        const docMatch = docs.some(x => (x.ho_ten_bac_si || "").toLowerCase().includes(term));
        return name.includes(term) || head.includes(term) || docMatch;
      });
      renderDepartments(filtered);
    });
  }

  loadData();
});
