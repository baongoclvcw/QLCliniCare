/**
 * Hiển thị "Ngày đặt lịch": dd/mm/yyyy - HH:mm (giờ địa phương / theo chuỗi DB không bị lệch UTC khi không có Z)
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatParts(day, month, year, hour, minute) {
  return `${pad2(day)}/${pad2(month)}/${year} - ${pad2(hour)}:${pad2(minute)}`;
}

/**
 * @param {string|Date|number|null|undefined} ngay — ngay_tao từ API hoặc Date
 */
function formatNgayGioVietNam(ngay) {
  if (ngay == null || ngay === "") return "";
  if (ngay instanceof Date) {
    if (Number.isNaN(ngay.getTime())) return "";
    return formatParts(
      ngay.getDate(),
      ngay.getMonth() + 1,
      ngay.getFullYear(),
      ngay.getHours(),
      ngay.getMinutes()
    );
  }
  const raw = String(ngay).trim();
  // Có múi giờ (Z hoặc +07:00) → chuyển sang giờ máy người dùng
  if (/Z$/i.test(raw) || /[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return formatParts(d.getDate(), d.getMonth() + 1, d.getFullYear(), d.getHours(), d.getMinutes());
    }
  }
  // Chuỗi kiểu SQL / ISO không Z: lấy đúng số trong chuỗi (giờ lưu trên server)
  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?/
  );
  if (m) {
    const y = +m[1];
    const mo = +m[2];
    const day = +m[3];
    const h = m[4] != null ? +m[4] : 0;
    const mi = m[5] != null ? +m[5] : 0;
    return formatParts(day, mo, y, h, mi);
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return formatParts(d.getDate(), d.getMonth() + 1, d.getFullYear(), d.getHours(), d.getMinutes());
  }
  return "";
}

/** Thời điểm hiện tại (sau khi đặt lịch thành công, khi API chưa trả ngay_tao) */
function formatNgayGioLucNay() {
  return formatNgayGioVietNam(new Date());
}
