/**
 * CLINICARE — client API (đồng bộ với backend)
 *
 * Quy ước chung:
 * - Auth (trừ login/register/check-exists): gửi header Authorization: Bearer <accessToken> (apiRequest tự gắn).
 * - Bác sĩ / lịch khám theo ngày: ưu tiên query doctorId + date; backend cũng chấp nhận ma_bac_si + ngay_kham.
 * - Lọc bác sĩ theo khoa: dept_id hoặc ma_khoa (cùng nghĩa).
 *
 * Body đặt lịch (POST /bookings): ngay_kham, ma_bac_si, ma_tai_khoan, gio_bat_dau_kham, mo_ta_trieu_chung?, gio_ket_thuc_kham?
 */

function buildQuery(params) {
  if (!params || typeof params !== "object") return "";
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v != null && v !== "")
  );
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
}

function qp(path, params) {
  return `${path}${buildQuery(params)}`;
}

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
    ...options,
    cache: options.cache ?? "default",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 200) || response.statusText };
    }
  }

  if (!response.ok) {
    throw new Error(data.message || "Có lỗi xảy ra");
  }

  return data;
}

const Api = {
  auth: {
    /** @param {{ email: string, password: string }} payload */
    login: payload => apiRequest("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
    logout: () => apiRequest("/auth/logout", { method: "POST" }),
    /** @param {{ email: string, password: string, fullName: string, phone: string }} payload */
    register: payload => apiRequest("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
    checkExists: query => apiRequest(qp("/auth/check-exists", query)),
    getProfile: () => apiRequest("/auth/profile"),
    updateProfile: payload => apiRequest("/auth/profile", { method: "PUT", body: JSON.stringify(payload) })
  },
  departments: {
    getAll: params => apiRequest(qp("/departments", params)),
    create: payload => apiRequest("/departments", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) =>
      apiRequest(`/departments/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
    delete: id => apiRequest(`/departments/${encodeURIComponent(id)}`, { method: "DELETE" })
  },
  doctors: {
    /** @param {{ dept_id?: string, ma_khoa?: string, search?: string, featured?: string }} [params] */
    getAll: params => apiRequest(qp("/doctors", params)),
    /** @param {string} id ma_bac_si */
    getById: (id, params) => apiRequest(qp(`/doctors/${encodeURIComponent(id)}`, params)),
    create: payload => apiRequest("/doctors", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) =>
      apiRequest(`/doctors/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
    delete: id => apiRequest(`/doctors/${encodeURIComponent(id)}`, { method: "DELETE" }),
    /** Query: doctorId hoặc ma_bac_si */
    getSchedules: query => apiRequest(qp("/doctors/admin/schedules", query)),
    /**
     * Body chuẩn (khớp POST /schedules/admin/config/working-hours): gio_sang_bat_dau, gio_sang_ket_thuc, gio_chieu_bat_dau, gio_chieu_ket_thuc, ma_bac_si, ngay_hieu_luc, ghi_chu?
     * Backend /doctors/admin/config/working-hours cũng chấp nhận alias sang_bd, sang_kt, chieu_bd, chieu_kt.
     */
    configWorkingHours: payload =>
      apiRequest("/doctors/admin/config/working-hours", { method: "POST", body: JSON.stringify(payload) })
  },
  schedules: {
    /** Query: doctorId hoặc ma_bac_si */
    getAll: query => apiRequest(qp("/schedules", query)),
    /** Query: doctorId + date (hoặc ma_bac_si + ngay_kham) */
    slots: query => apiRequest(qp("/schedules/slots", query), { cache: "no-store" }),
    create: payload => apiRequest("/schedules", { method: "POST", body: JSON.stringify(payload) }),
    generate: payload =>
      apiRequest("/schedules/admin/schedules/generate", { method: "POST", body: JSON.stringify(payload) }),
    configWorkingHours: payload =>
      apiRequest("/schedules/admin/config/working-hours", { method: "POST", body: JSON.stringify(payload) })
  },
  bookings: {
    create: payload => apiRequest("/bookings", { method: "POST", body: JSON.stringify(payload) }),
    /** Cần Bearer token. Query: page, pageSize */
    getMine: params => apiRequest(qp("/bookings/me", params)),
    /** Query: page, pageSize, status, date, search */
    getAdmin: params => apiRequest(qp("/bookings/admin/bookings", params), { cache: "no-store" }),
    getById: id => apiRequest(`/bookings/${encodeURIComponent(id)}`),
    update: (id, payload) =>
      apiRequest(`/bookings/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
    cancel: id =>
      apiRequest(`/bookings/${encodeURIComponent(id)}/cancel`, { method: "PATCH" }),
    /** Query: doctorId + date hoặc ma_bac_si + ngay_kham */
    occupiedSlots: query => apiRequest(qp("/bookings/occupied-slots", query)),
    availableSlots: query => apiRequest(qp("/bookings/available-slots", query))
  },
  stats: {
    /** @param {{ date?: string }} [params] date=YYYY-MM-DD (giờ địa phương, khớp thống kê “hôm nay”) */
    summary: params => apiRequest(qp("/admin/stats/summary", params), { cache: "no-store" }),
    /** @param {{ year?: number }} [params] — năm dương lịch; với năm hiện tại: các tháng T1…T(tháng nay); năm khác: đủ T1–T12. TT03, field throughMonth */
    growth: params => apiRequest(qp("/admin/stats/growth", params), { cache: "no-store" }),
    activities: () => apiRequest("/admin/stats/activities", { cache: "no-store" }),
    /** @param {{ date?: string }} [params] */
    todayDoctors: params => apiRequest(qp("/admin/stats/today-doctors", params), { cache: "no-store" }),
    /** @param {{ date?: string, pageSize?: number }} [params] — lịch ngày >= date, trừ đã hủy/đã khám */
    upcomingBookings: params => apiRequest(qp("/admin/stats/upcoming-bookings", params), { cache: "no-store" })
  }
};
