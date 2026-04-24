(function () {
  let detail = null;
  let bookingId = null;

  function formatDMY(ngay) {
    if (!ngay) return "—";
    const s = String(ngay).split("T")[0];
    const p = s.split("-");
    if (p.length !== 3) return s;
    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  function formatNgayTao(dt) {
    if (!dt) return "—";
    if (typeof formatNgayGioVietNam === "function") {
      const s = formatNgayGioVietNam(dt);
      if (s) return s;
    }
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return String(dt);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const y = d.getFullYear();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${y} - ${h}:${m}`;
  }

  function badgeFor(ma, ten) {
    if (ma === "TT02") return { cls: "status-cancelled", text: ten || "Đã hủy" };
    if (ma === "TT03") return { cls: "status-completed", text: ten || "Đã khám xong" };
    if (ma === "TT04") return { cls: "status-pending", text: ten || "Chờ xác nhận" };
    return { cls: "status-confirmed", text: ten || "Đã xác nhận" };
  }

  function applyUiState() {
    if (!detail) return;
    const ma = detail.ma_trang_thai;
    const { cls, text } = badgeFor(ma, detail.ten_trang_thai);
    const badge = document.getElementById("detailStatusBadge");
    badge.className = "status-badge " + cls;
    badge.textContent = text;

    const locked = ma === "TT02" || ma === "TT03";
    const editBtn = document.getElementById("btnEditBooking");
    const cancelBtn = document.getElementById("btnCancelBooking");
    const completeBtn = document.getElementById("btnCompleteVisit");
    if (editBtn) editBtn.style.display = locked ? "none" : "";
    if (cancelBtn) cancelBtn.style.display = locked ? "none" : "";
    if (completeBtn) completeBtn.style.display = !locked && ma === "TT01" ? "" : "none";

    const alertTitle = document.querySelector(".alert-title");
    const alertText = document.querySelector(".alert-text");
    if (alertTitle && alertText) {
      if (ma === "TT02") {
        alertTitle.textContent = "Thông tin hủy lịch";
        alertText.textContent =
          "Lịch hẹn này đã hủy. Mọi thao tác chỉnh sửa hoặc thay đổi trạng thái đều bị khóa.";
      } else if (ma === "TT03") {
        alertTitle.textContent = "Hoàn tất khám bệnh";
        alertText.textContent = "Lịch hẹn này bệnh nhân đã khám xong.";
      } else {
        alertTitle.textContent = "Lưu ý quản trị";
        alertText.textContent =
          "Nếu cần hủy hoặc đổi giờ khám, vui lòng liên hệ bệnh nhân trước để đảm bảo minh bạch thông tin.";
      }
    }
  }

  function formatDob(ngay) {
    if (!ngay) return "";
    const s = String(ngay).split("T")[0];
    const p = s.split("-");
    if (p.length !== 3) return s;
    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  function patientText(v) {
    if (v == null) return "Chưa cập nhật";
    const s = String(v).trim();
    return s || "Chưa cập nhật";
  }

  function fillDom() {
    if (!detail) return;
    document.getElementById("detailMaLich").textContent = detail.ma_lich_hen || "—";
    document.getElementById("detailNgayTao").textContent = formatNgayTao(detail.ngay_tao);
    document.getElementById("detailNgayKham").textContent = formatDMY(detail.ngay_kham);
    const g1 = detail.gio_bat_dau_kham ? String(detail.gio_bat_dau_kham).slice(0, 5) : "";
    const g2 = detail.gio_ket_thuc_kham ? String(detail.gio_ket_thuc_kham).slice(0, 5) : "";
    document.getElementById("detailGio").textContent =
      g1 && g2 ? `${g1} - ${g2}` : g1 || "—";
    document.getElementById("detailKhoa").textContent = detail.khoa || "—";
    document.getElementById("detailBacSi").textContent = detail.bac_si || "—";
    document.getElementById("detailMoTa").textContent = detail.mo_ta_trieu_chung || "—";
    document.getElementById("detailBenhNhan").textContent = patientText(detail.benh_nhan);
    const phoneEl = document.getElementById("detailPhone");
    if (phoneEl) {
      const p = detail.so_dien_thoai != null ? String(detail.so_dien_thoai).trim() : "";
      phoneEl.textContent = patientText(p);
    }
    const genEl = document.getElementById("detailGender");
    if (genEl) genEl.textContent = patientText(detail.gioi_tinh ? String(detail.gioi_tinh).trim() : "");
    const dobEl = document.getElementById("detailDob");
    if (dobEl) {
      const dmy = formatDob(detail.ngay_sinh);
      dobEl.textContent = dmy || "Chưa cập nhật";
    }

    document.getElementById("summaryBacSi").textContent = detail.bac_si || "—";
    document.getElementById("summaryChuyenKhoa").textContent =
      detail.chuyen_khoa_bac_si || detail.khoa || "—";
    document.getElementById("summaryPhong").textContent = detail.ma_phong
      ? "Phòng " + detail.ma_phong
      : "—";

    const desc = document.getElementById("cancelModalDesc");
    if (desc) {
      desc.innerHTML = `Bạn có chắc chắn muốn hủy lịch hẹn <strong>${detail.ma_lich_hen}</strong> của bệnh nhân <strong>${detail.benh_nhan || ""}</strong> không?`;
    }

    applyUiState();
  }

  window.showCancelModal = function () {
    document.getElementById("cancelModal").classList.add("show");
  };
  window.hideCancelModal = function () {
    document.getElementById("cancelModal").classList.remove("show");
  };

  window.confirmCancel = async function () {
    if (!bookingId) return;
    try {
      await Api.bookings.update(bookingId, { ma_trang_thai: "TT02" });
      sessionStorage.setItem("adminBookingToast", "Đã hủy lịch hẹn thành công.");
      window.location.href = "quanlylichhenadmin.html";
    } catch (e) {
      alert(e.message || "Không hủy được lịch");
    }
  };

  async function completeVisit() {
    if (!bookingId) return;
    try {
      await Api.bookings.update(bookingId, { ma_trang_thai: "TT03" });
      sessionStorage.setItem("adminBookingToast", "Đã cập nhật: đã khám xong.");
      window.location.href = "quanlylichhenadmin.html";
    } catch (e) {
      alert(e.message || "Không cập nhật được");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bookingId = sessionStorage.getItem("adminBookingId");
    if (!bookingId) {
      window.location.href = "quanlylichhenadmin.html";
      return;
    }

    document.getElementById("cancelModal").addEventListener("click", function (e) {
      if (e.target === this) window.hideCancelModal();
    });

    const completeBtn = document.getElementById("btnCompleteVisit");
    if (completeBtn) completeBtn.addEventListener("click", completeVisit);

    try {
      detail = await Api.bookings.getById(bookingId);
      fillDom();
    } catch (e) {
      alert(e.message || "Không tải được chi tiết");
      window.location.href = "quanlylichhenadmin.html";
    }
  });
})();
