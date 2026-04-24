const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

function pickToday(req) {
    const q = req.query.date;
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(String(q).trim())) return String(q).trim();
    return null;
}

function nodeLocalDateISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 1. 4 thẻ thống kê — luôn theo một ngày (query ?date= hoặc ngày local server)
exports.getSummaryStats = async (req, res) => {
    try {
        const refDate = pickToday(req) || nodeLocalDateISO();
        const stats = await sequelize.query(
            `
            SELECT 
                ISNULL((SELECT COUNT(DISTINCT ma_tai_khoan) FROM Lich_hen WHERE ngay_kham = CAST(:refDate AS DATE)), 0) as tong_benh_nhan_hom_nay,
                ISNULL((SELECT COUNT(*) FROM Lich_hen WHERE ngay_kham = CAST(:refDate AS DATE)), 0) as tong_lich_hen_hom_nay,
                ISNULL((
                    SELECT COUNT(DISTINCT x.ma_bac_si) FROM (
                        SELECT ma_bac_si FROM Lich_lam_viec WHERE ngay_lam_viec = CAST(:refDate AS DATE)
                        UNION
                        SELECT ma_bac_si FROM Lich_hen WHERE ngay_kham = CAST(:refDate AS DATE)
                    ) x
                ), 0) as tong_bac_si_dang_lam,
                ISNULL((SELECT COUNT(*) FROM Lich_hen WHERE ngay_kham = CAST(:refDate AS DATE) AND ma_trang_thai = 'TT02'), 0) as tong_lich_da_huy_hom_nay
        `,
            {
                replacements: { refDate },
                type: QueryTypes.SELECT
            }
        );
        const row = stats[0] || {};
        res.json({
            tong_benh_nhan_hom_nay: Number(row.tong_benh_nhan_hom_nay ?? row.TONG_BENH_NHAN_HOM_NAY ?? 0),
            tong_lich_hen_hom_nay: Number(row.tong_lich_hen_hom_nay ?? row.TONG_LICH_HEN_HOM_NAY ?? 0),
            tong_bac_si_dang_lam: Number(row.tong_bac_si_dang_lam ?? row.TONG_BAC_SI_DANG_LAM ?? 0),
            tong_lich_da_huy_hom_nay: Number(row.tong_lich_da_huy_hom_nay ?? row.TONG_LICH_DA_HUY_HOM_NAY ?? 0)
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy thống kê: " + error.message });
    }
};

// 2. Biểu đồ theo tháng (?year=): TT03, COUNT(DISTINCT ma_tai_khoan) GROUP BY MONTH(ngay_kham); năm hiện tại: T1…tháng nay
exports.getGrowthChart = async (req, res) => {
    try {
        const now = new Date();
        const y = req.query.year ? parseInt(String(req.query.year), 10) : now.getFullYear();
        if (!Number.isFinite(y) || y < 2000 || y > 2100) {
            return res.status(400).json({ message: "Tham số year không hợp lệ." });
        }

        const rows = await sequelize.query(
            `
            SELECT MONTH(CAST(lh.ngay_kham AS DATE)) AS mo,
                COUNT(DISTINCT lh.ma_tai_khoan) AS cnt
            FROM dbo.Lich_hen lh
            WHERE lh.ma_trang_thai = 'TT03'
              AND YEAR(CAST(lh.ngay_kham AS DATE)) = :y
            GROUP BY MONTH(CAST(lh.ngay_kham AS DATE))
        `,
            { replacements: { y }, type: QueryTypes.SELECT }
        );

        const byMonth = new Map();
        (rows || []).forEach((r) => {
            const mo = Number(r.mo ?? r.MO ?? r.m);
            const c = Number(r.cnt ?? r.CNT ?? 0);
            if (mo >= 1 && mo <= 12) byMonth.set(mo, c);
        });

        const ref = new Date();
        const currentYear = ref.getFullYear();
        const currentMonth = ref.getMonth() + 1;
        const lastMonthInChart = y === currentYear ? Math.min(currentMonth, 12) : 12;

        const points = [];
        for (let month = 1; month <= lastMonthInChart; month++) {
            points.push({
                month,
                label: `T${month}`,
                count: byMonth.get(month) ?? 0
            });
        }

        res.json({
            granularity: "month",
            year: y,
            throughMonth: lastMonthInChart,
            points
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Hoạt động gần đây: tạo lịch + cập nhật (ngay_cap_nhat)
exports.getRecentActivities = async (req, res) => {
    try {
        const logs = await sequelize.query(
            `
            SELECT TOP 25 time, message, type FROM (
                SELECT 
                    lh.ngay_tao as time,
                    CASE 
                        WHEN lh.ma_trang_thai = 'TT02' THEN N'Đã hủy lịch · ' + ISNULL(bn.ho_ten, N'') + N' · BS. ' + bs.ho_ten_bac_si
                        WHEN lh.ma_trang_thai = 'TT03' THEN N'Hoàn tất khám · ' + ISNULL(bn.ho_ten, N'') + N' · BS. ' + bs.ho_ten_bac_si
                        ELSE N'Đặt lịch mới · ' + ISNULL(bn.ho_ten, N'') + N' · BS. ' + bs.ho_ten_bac_si
                    END as message,
                    CASE WHEN lh.ma_trang_thai = 'TT01' THEN 'success' WHEN lh.ma_trang_thai = 'TT03' THEN 'success' WHEN lh.ma_trang_thai = 'TT02' THEN 'warning' ELSE 'info' END as type
                FROM Lich_hen lh
                JOIN Bac_si bs ON lh.ma_bac_si = bs.ma_bac_si
                JOIN Thong_tin_nguoi_dung bn ON lh.ma_tai_khoan = bn.ma_tai_khoan

                UNION ALL

                SELECT 
                    lh.ngay_cap_nhat as time,
                    N'Cập nhật lịch ' + lh.ma_lich_hen + N' · ' + tt.ten_trang_thai + N' · ' + ISNULL(bn.ho_ten, N'') as message,
                    'info' as type
                FROM Lich_hen lh
                JOIN Bac_si bs ON lh.ma_bac_si = bs.ma_bac_si
                JOIN Thong_tin_nguoi_dung bn ON lh.ma_tai_khoan = bn.ma_tai_khoan
                JOIN Trang_thai tt ON lh.ma_trang_thai = tt.ma_trang_thai
                WHERE lh.ngay_cap_nhat IS NOT NULL AND lh.ngay_cap_nhat > lh.ngay_tao
            ) u
            WHERE u.time IS NOT NULL
            ORDER BY u.time DESC
        `,
            { type: QueryTypes.SELECT }
        );
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. Bác sĩ có lịch làm việc / lịch hẹn trong ngày ?date=
exports.getTodayDoctors = async (req, res) => {
    try {
        const refDate = pickToday(req) || nodeLocalDateISO();
        const doctors = await sequelize.query(
            `
            SELECT DISTINCT bs.ma_bac_si, bs.ho_ten_bac_si, k.ten_khoa, 'online' as status
            FROM (
                SELECT ma_bac_si FROM Lich_lam_viec WHERE ngay_lam_viec = CAST(:refDate AS DATE)
                UNION
                SELECT ma_bac_si FROM Lich_hen WHERE ngay_kham = CAST(:refDate AS DATE)
            ) q
            JOIN Bac_si bs ON q.ma_bac_si = bs.ma_bac_si
            JOIN Khoa k ON bs.ma_khoa = k.ma_khoa
        `,
            { replacements: { refDate }, type: QueryTypes.SELECT }
        );
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 5. Lịch sắp tới (ngày khám >= ?date=) — FE lọc thêm giờ trong ngày theo đồng hồ trình duyệt
exports.getUpcomingBookings = async (req, res) => {
    try {
        const today = pickToday(req) || nodeLocalDateISO();
        const limit = Math.min(parseInt(req.query.pageSize || req.query.limit || "80", 10), 200);

        const items = await sequelize.query(
            `
            SELECT lh.ma_lich_hen, lh.ma_trang_thai, tt.ten_trang_thai, lh.ngay_kham,
                CONVERT(VARCHAR(5), lh.gio_bat_dau_kham, 108) as gio_kham_hien_thi,
                CONVERT(VARCHAR(5), lh.gio_bat_dau_kham, 108) as gio_bat_dau_kham,
                bn.ho_ten, bs.ho_ten_bac_si
            FROM Lich_hen lh
            JOIN Thong_tin_nguoi_dung bn ON lh.ma_tai_khoan = bn.ma_tai_khoan
            JOIN Bac_si bs ON lh.ma_bac_si = bs.ma_bac_si
            JOIN Trang_thai tt ON lh.ma_trang_thai = tt.ma_trang_thai
            WHERE lh.ma_trang_thai NOT IN ('TT02', 'TT03')
              AND CAST(lh.ngay_kham AS DATE) >= CAST(:today AS DATE)
            ORDER BY lh.ngay_kham ASC, lh.gio_bat_dau_kham ASC
            OFFSET 0 ROWS FETCH NEXT :limit ROWS ONLY
        `,
            { replacements: { today, limit }, type: QueryTypes.SELECT }
        );

        const [totalRow] = await sequelize.query(
            `
            SELECT COUNT(*) as total
            FROM Lich_hen lh
            WHERE lh.ma_trang_thai NOT IN ('TT02', 'TT03')
              AND CAST(lh.ngay_kham AS DATE) >= CAST(:today AS DATE)
        `,
            { replacements: { today }, type: QueryTypes.SELECT }
        );

        res.json({
            items,
            totalItems: Number(totalRow?.total ?? totalRow?.TOTAL ?? 0),
            page: 1,
            pageSize: limit
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};