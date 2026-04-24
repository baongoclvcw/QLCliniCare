const crypto = require('crypto');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

function makeUniqueMaCauHinh() {
    const t = Date.now().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-4);
    const hex = crypto.randomBytes(3).toString("hex").toUpperCase();
    return (`CH${t}${hex}`).slice(0, 10);
}

/**
 * 1. Xem lịch làm việc thực tế (Admin - Mục E)
 */
exports.getSchedules = async (req, res) => {
    try {
        const doctorId = req.query.doctorId || req.query.ma_bac_si;
        if (!doctorId) {
            return res.status(400).json({ message: "Vui lòng cung cấp doctorId hoặc ma_bac_si!" });
        }

        const results = await sequelize.query(`
            SELECT 
                ngay_lam_viec as date,
                ma_phong as room,
                MAX(CASE WHEN ca_lam = N'Ca sáng' THEN 1 ELSE 0 END) as morning,
                MAX(CASE WHEN ca_lam = N'Ca chiều' THEN 1 ELSE 0 END) as afternoon
            FROM Lich_lam_viec
            WHERE ma_bac_si = :doctorId
            GROUP BY ngay_lam_viec, ma_phong
            ORDER BY ngay_lam_viec ASC
        `, { 
            replacements: { doctorId },
            type: QueryTypes.SELECT 
        });

        res.json({ items: results });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống!", error: error.message });
    }
};

/**
 * 2. Lưu cấu hình giờ làm & Tái tạo lịch cho 1 bác sĩ (Admin - Mục E & F)
 */
exports.configWorkingHours = async (req, res) => {
    try {
        const data = req.body;
        if (!data.ma_bac_si || !data.ngay_hieu_luc) {
            return res.status(400).json({ message: "Thiếu mã bác sĩ hoặc ngày hiệu lực!" });
        }

        const sangBd = data.gio_sang_bat_dau ?? data.sang_bd;
        const sangKt = data.gio_sang_ket_thuc ?? data.sang_kt;
        const chieuBd = data.gio_chieu_bat_dau ?? data.chieu_bd;
        const chieuKt = data.gio_chieu_ket_thuc ?? data.chieu_kt;
        if (!sangBd || !sangKt || !chieuBd || !chieuKt) {
            return res.status(400).json({
                message: "Thiếu khung giờ: cần gio_sang_bat_dau, gio_sang_ket_thuc, gio_chieu_bat_dau, gio_chieu_ket_thuc (định dạng HH:mm hoặc HH:mm:ss)."
            });
        }

        const normTime = (t) => {
            const s = String(t).trim();
            if (/^\d{1,2}:\d{2}$/.test(s)) return `${s.split(":")[0].padStart(2, "0")}:${s.split(":")[1]}:00`;
            if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
            return s;
        };

        const ma_cau_hinh = makeUniqueMaCauHinh();

        /**
         * UIX trên (ma_bac_si, ngay_hieu_luc): SP đổi trạng thái bản cũ sang "Hết hiệu lực"
         * nhưng không xóa dòng → INSERT cùng ngày vẫn trùng khóa. Xóa mọi dòng trùng
         * ngày hiệu lực trước khi EXEC sp (sp sẽ INSERT bản mới "Đang áp dụng").
         */
        await sequelize.transaction(async (t) => {
            await sequelize.query(
                `
                DELETE FROM dbo.Cau_hinh_gio_lam_bac_si
                WHERE ma_bac_si = :ma_bac_si
                  AND CAST(ngay_hieu_luc AS DATE) = CAST(:ngay_hieu_luc AS DATE)
                `,
                {
                    replacements: {
                        ma_bac_si: data.ma_bac_si,
                        ngay_hieu_luc: data.ngay_hieu_luc
                    },
                    transaction: t
                }
            );

            await sequelize.query(
                `
                EXEC dbo.sp_DoiGioLamBacSi 
                    @ma_cau_hinh = :ma_cau_hinh, @ma_bac_si = :ma_bac_si, 
                    @ngay_hieu_luc = :ngay_hieu_luc, @gio_sang_bat_dau = :gio_sang_bat_dau, 
                    @gio_sang_ket_thuc = :gio_sang_ket_thuc, @gio_chieu_bat_dau = :gio_chieu_bat_dau, 
                    @gio_chieu_ket_thuc = :gio_chieu_ket_thuc, @so_ngay_tao_lich = 30, @ghi_chu = :ghi_chu
            `,
                {
                    replacements: {
                        ma_cau_hinh,
                        ma_bac_si: data.ma_bac_si,
                        ngay_hieu_luc: data.ngay_hieu_luc,
                        gio_sang_bat_dau: normTime(sangBd),
                        gio_sang_ket_thuc: normTime(sangKt),
                        gio_chieu_bat_dau: normTime(chieuBd),
                        gio_chieu_ket_thuc: normTime(chieuKt),
                        ghi_chu: data.ghi_chu || null
                    },
                    transaction: t
                }
            );

            const dow = data.ngay_lam_trong_tuan;
            if (Array.isArray(dow) && dow.length > 0 && dow.length < 5) {
                const allowed = [...new Set(dow.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 5))].sort(
                    (a, b) => a - b
                );
                if (allowed.length > 0 && allowed.length < 5) {
                    const ph = allowed.map((_, i) => `:d${i}`).join(', ');
                    const delRepl = {
                        ma_bac_si: data.ma_bac_si,
                        ngay_hieu_luc: data.ngay_hieu_luc,
                        ...Object.fromEntries(allowed.map((v, i) => [`d${i}`, v]))
                    };
                    /**
                     * Khớp số thứ với khoavabacsi (Date.getDay(): T2=1 … T6=5).
                     * DATEPART(WEEKDAY) thuần phụ thuộc @@DATEFIRST; tách SET/EXEC có thể khiến Thứ 5 (js=4)
                     * bị xóa nhầm. Dùng biểu thức không phụ thuộc DATEFIRST (theo MSDN/SO):
                     * Thứ 2=1 … Chủ nhật=7 — trùng với chip Mon–Fri = 1..5.
                     */
                    await sequelize.query(
                        `
                        DELETE FROM dbo.Lich_lam_viec
                        WHERE ma_bac_si = :ma_bac_si
                          AND ngay_lam_viec >= :ngay_hieu_luc
                          AND (
                            (DATEPART(WEEKDAY, ngay_lam_viec) + @@DATEFIRST + 5) % 7 + 1
                          ) NOT IN (${ph})
                        `,
                        { replacements: delRepl, transaction: t }
                    );
                }
            }
        });

        res.json({ message: "Cập nhật khung giờ và tái tạo lịch thành công!" });
    } catch (error) {
        const raw =
            error?.parent?.message ||
            error?.original?.message ||
            error?.parent?.original?.message ||
            error?.message ||
            "Lỗi cập nhật giờ làm";
        res.status(500).json({ message: String(raw) });
    }
};

/**
 * 3. Sinh lịch làm việc hàng loạt cho TẤT CẢ bác sĩ (Admin - Mục F)
 * ĐÃ THÊM LOGIC KIỂM TRA TRÙNG LẶP
 */
exports.generateSchedules = async (req, res) => {
    try {
        const { tu_ngay, so_ngay } = req.body;
        const days = so_ngay || 30;

        if (!tu_ngay) return res.status(400).json({ message: "Vui lòng chọn ngày bắt đầu!" });

        // --- BƯỚC DỌN DẸP LỊCH TRÙNG ---
        // Xóa những ca trực TRỐNG (chưa có người đặt khám) trong khoảng thời gian sắp sinh lịch
        // Điều này giúp ghi đè lịch mới theo cấu hình giờ làm mới nhất của bác sĩ
        await sequelize.query(`
            DELETE FROM Lich_lam_viec 
            WHERE ngay_lam_viec BETWEEN :tu_ngay AND DATEADD(day, :so_ngay, :tu_ngay)
            AND NOT EXISTS (
                SELECT 1 FROM Lich_hen 
                WHERE Lich_hen.ma_bac_si = Lich_lam_viec.ma_bac_si 
                AND Lich_hen.ngay_kham = Lich_lam_viec.ngay_lam_viec
            )
        `, { 
            replacements: { tu_ngay, so_ngay: days } 
        });

        // --- BƯỚC SINH LỊCH MỚI ---
        await sequelize.query(`
            EXEC dbo.sp_TaoLichMacDinhChoTatCaBacSi 
                @tu_ngay = :tu_ngay, @so_ngay = :so_ngay
        `, { 
            replacements: { tu_ngay, so_ngay: days } 
        });

        res.json({ 
            message: `Hệ thống đã dọn dẹp lịch cũ (ca trống) và tái tạo lịch mới cho ${days} ngày kể từ ${tu_ngay}!` 
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi sinh lịch: " + error.message });
    }
};

/**
 * 4. Tạo lịch làm việc thủ công (Admin - Mục F)
 */
exports.createManualSchedule = async (req, res) => {
    try {
        const data = req.body;
        await sequelize.query(`
            INSERT INTO Lich_lam_viec (ngay_lam_viec, gio_bat_dau, gio_ket_thuc, ca_lam, ma_bac_si, ma_phong)
            VALUES (:ngay_lam_viec, :gio_bat_dau, :gio_ket_thuc, :ca_lam, :ma_bac_si, :ma_phong)
        `, { replacements: data });
        res.json({ message: "Gán lịch thủ công thành công!" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi dữ liệu không hợp lệ!" });
    }
};

/**
 * 5. Lấy giờ khám trống (Bệnh nhân - Mục B)
 */
exports.getAvailableSlots = async (req, res) => {
    try {
        const doctorId = req.query.doctorId || req.query.ma_bac_si;
        const date = req.query.date || req.query.ngay_kham;
        if (!doctorId || !date) {
            return res.status(400).json({ message: "Thiếu doctorId (hoặc ma_bac_si) hoặc date (hoặc ngay_kham)!" });
        }

        const config = await sequelize.query(`
            SELECT TOP 1 
                CONVERT(VARCHAR(5), c.gio_sang_bat_dau, 108) as gsbđ, 
                CONVERT(VARCHAR(5), c.gio_sang_ket_thuc, 108) as gskt, 
                CONVERT(VARCHAR(5), c.gio_chieu_bat_dau, 108) as gcbđ, 
                CONVERT(VARCHAR(5), c.gio_chieu_ket_thuc, 108) as gckt, 
                k.thoi_luong_phut
            FROM Cau_hinh_gio_lam_bac_si c 
            JOIN Khung_gio_kham k ON c.ma_bac_si = k.ma_bac_si
            WHERE c.ma_bac_si = :doctorId AND c.trang_thai = N'Đang áp dụng' AND c.ngay_hieu_luc <= :date
            ORDER BY c.ngay_hieu_luc DESC
        `, { replacements: { doctorId, date }, type: QueryTypes.SELECT });

        if (!config.length) return res.status(404).json({ message: "Bác sĩ không có lịch làm việc ngày này!" });

        const [workDay] = await sequelize.query(
            `SELECT TOP 1 1 AS ok FROM dbo.Lich_lam_viec WHERE ma_bac_si = :doctorId AND ngay_lam_viec = :date`,
            { replacements: { doctorId, date }, type: QueryTypes.SELECT }
        );
        if (!workDay) {
            return res.status(404).json({ message: "Bác sĩ không có ca làm việc vào ngày này!" });
        }

        const booked = await sequelize.query(`
            SELECT CONVERT(VARCHAR(5), gio_bat_dau_kham, 108) as gio 
            FROM Lich_hen 
            WHERE ma_bac_si = :doctorId AND ngay_kham = :date AND ma_trang_thai = 'TT01'
        `, { replacements: { doctorId, date }, type: QueryTypes.SELECT });
        
        const bookedTimes = booked.map(b => b.gio);
        const duration = config[0].thoi_luong_phut || 30;

        const split = (s, e) => {
            let res = []; if (!s || !e) return res;
            let [sh, sm] = s.split(':').map(Number);
            let [eh, em] = e.split(':').map(Number);
            for (let c = sh * 60 + sm; c < eh * 60 + em; c += duration) {
                let h = Math.floor(c / 60).toString().padStart(2, '0');
                let m = (c % 60).toString().padStart(2, '0');
                let t = `${h}:${m}`;
                res.push({ time: t, available: !bookedTimes.includes(t) });
            }
            return res;
        };

        const allSlots = [
            ...split(config[0].gsbđ, config[0].gskt),
            ...split(config[0].gcbđ, config[0].gckt)
        ];

        res.json({ doctorId, date, slots: allSlots });
    } catch (error) {
        res.status(500).json({ message: "Lỗi Slots: " + error.message });
    }
};