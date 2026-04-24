const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

/**
 * 1. ĐẶT LỊCH HẸN MỚI
 * Sửa lỗi: Lấy ma_khung_gio động để cho phép đặt nhiều ca khác nhau trong cùng 1 ngày
 */
exports.createAppointment = async (req, res) => {
    try {
        const d = req.body;
        if (!d.ma_tai_khoan || !String(d.ma_tai_khoan).trim()) {
            return res.status(400).json({ message: "Thiếu mã tài khoản bệnh nhân." });
        }
        const [profRow] = await sequelize.query(
            `
            SELECT TOP 1 NULLIF(LTRIM(RTRIM(t.ho_ten)), N'') AS ho_ten
            FROM Thong_tin_nguoi_dung t
            WHERE t.ma_tai_khoan = :ma_tk
            ORDER BY CASE WHEN NULLIF(LTRIM(RTRIM(t.ho_ten)), N'') IS NOT NULL THEN 0 ELSE 1 END, t.ma_nguoi_dung DESC
            `,
            { replacements: { ma_tk: d.ma_tai_khoan }, type: QueryTypes.SELECT }
        );
        const hoTen = profRow && (profRow.ho_ten ?? profRow.HO_TEN);
        if (!hoTen || !String(hoTen).trim()) {
            return res.status(400).json({
                message: "Hồ sơ bệnh nhân chưa có họ tên hợp lệ. Vui lòng cập nhật hồ sơ trước khi đặt lịch."
            });
        }
        const bad = ["—", "Chưa có trong hồ sơ"];
        if (bad.includes(String(hoTen).trim())) {
            return res.status(400).json({
                message: "Thông tin họ tên trong hồ sơ không hợp lệ. Vui lòng cập nhật họ tên thật trước khi đặt lịch."
            });
        }

        const ma_lh = 'LH' + Date.now().toString().slice(-5);

        // 1. Tính giờ kết thúc mặc định (+30p)
        let gio_kt = d.gio_ket_thuc_kham;
        if (!gio_kt && d.gio_bat_dau_kham) {
            const [hours, minutes] = d.gio_bat_dau_kham.split(':');
            const start = new Date(2026, 0, 1, parseInt(hours), parseInt(minutes));
            start.setMinutes(start.getMinutes() + 30);
            gio_kt = start.toTimeString().substring(0, 5);
        }

        // 2. Chèn lịch hẹn
        // Chỗ (SELECT TOP 1...) giúp lấy mã khung giờ của đúng BS đó thay vì viết cứng KG01
        await sequelize.query(`
            INSERT INTO Lich_hen (
                ma_lich_hen, ngay_kham, mo_ta_trieu_chung, ma_tai_khoan, 
                ma_khung_gio, ma_bac_si, ma_trang_thai, 
                gio_bat_dau_kham, gio_ket_thuc_kham, ngay_tao
            ) VALUES (
                :ma_lh, :ngay_kham, :mo_ta, :ma_tk, 
                (SELECT TOP 1 ma_khung_gio FROM Khung_gio_kham WHERE ma_bac_si = :ma_bs), 
                :ma_bs, 'TT01', 
                :gio_bd, :gio_kt, GETDATE()
            )
        `, {
            replacements: {
                ma_lh, 
                ngay_kham: d.ngay_kham, 
                mo_ta: d.mo_ta_trieu_chung || null,
                ma_tk: d.ma_tai_khoan, 
                ma_bs: d.ma_bac_si,
                gio_bd: d.gio_bat_dau_kham, 
                gio_kt
            }
        });

        const [taoRow] = await sequelize.query(
            `SELECT CONVERT(VARCHAR(19), ngay_tao, 120) AS ngay_tao FROM Lich_hen WHERE ma_lich_hen = :ma_lh`,
            { replacements: { ma_lh }, type: QueryTypes.SELECT }
        );

        const [phongRow] = await sequelize.query(`
            SELECT TOP 1 llv.ma_phong, pk.ten_phong
            FROM Lich_lam_viec llv
            LEFT JOIN Phong_kham pk ON llv.ma_phong = pk.ma_phong
            WHERE llv.ma_bac_si = :ma_bs AND llv.ngay_lam_viec = :ngay_kham
            ORDER BY llv.gio_bat_dau
        `, {
            replacements: { ma_bs: d.ma_bac_si, ngay_kham: d.ngay_kham },
            type: QueryTypes.SELECT
        });

        res.status(201).json({
            message: "Đặt lịch thành công!",
            ma_lich_hen: ma_lh,
            ma_trang_thai: 'TT01',
            ngay_tao: taoRow?.ngay_tao ?? null,
            ma_phong: phongRow?.ma_phong || null,
            ten_phong: phongRow?.ten_phong || null
        });
    } catch (error) {
        // Trả về lỗi thông minh khi thực sự bị trùng giờ khám
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: "Bác sĩ đã có lịch hẹn vào giờ này, vui lòng chọn giờ khác!" });
        }
        res.status(500).json({ message: "Lỗi đặt lịch: " + error.message });
    }
};

/**
 * 2. XEM LỊCH SỬ (Bệnh nhân)
 */
exports.getMyHistory = async (req, res) => {
    try {
        const ma_tai_khoan = req.user.id;
        const { page = 1, pageSize = 5 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const history = await sequelize.query(`
            SELECT 
                lh.ma_lich_hen, 
                lh.ma_trang_thai, 
                tt.ten_trang_thai, 
                lh.ma_bac_si,
                bs.ho_ten_bac_si, 
                k.ma_khoa,
                k.ten_khoa, 
                lh.ngay_kham, 
                CONVERT(VARCHAR(5), lh.gio_bat_dau_kham, 108) as gio_bat_dau_kham,
                CONVERT(VARCHAR(19), lh.ngay_tao, 120) as ngay_tao,
                lh.mo_ta_trieu_chung,
                bn.ho_ten as benh_nhan,
                bn.so_dien_thoai,
                bn.ngay_sinh,
                bn.gioi_tinh,
                ph.ma_phong,
                ph.ten_phong
            FROM Lich_hen lh
            JOIN Bac_si bs ON lh.ma_bac_si = bs.ma_bac_si
            JOIN Khoa k ON bs.ma_khoa = k.ma_khoa
            JOIN Trang_thai tt ON lh.ma_trang_thai = tt.ma_trang_thai
            OUTER APPLY (
                SELECT TOP 1 t.ho_ten, t.so_dien_thoai, t.ngay_sinh, t.gioi_tinh
                FROM Thong_tin_nguoi_dung t
                WHERE t.ma_tai_khoan = lh.ma_tai_khoan
                ORDER BY
                    CASE WHEN NULLIF(LTRIM(RTRIM(t.ho_ten)), N'') IS NOT NULL THEN 0 ELSE 1 END,
                    t.ma_nguoi_dung DESC
            ) bn
            OUTER APPLY (
                SELECT TOP 1 llv2.ma_phong, pk.ten_phong
                FROM Lich_lam_viec llv2
                LEFT JOIN Phong_kham pk ON llv2.ma_phong = pk.ma_phong
                WHERE llv2.ma_bac_si = lh.ma_bac_si AND llv2.ngay_lam_viec = lh.ngay_kham
                ORDER BY llv2.gio_bat_dau
            ) ph
            WHERE lh.ma_tai_khoan = :ma_tai_khoan
              AND lh.ma_trang_thai <> 'TT02'
            ORDER BY lh.ngay_kham DESC, lh.gio_bat_dau_kham DESC
            OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY
        `, { replacements: { ma_tai_khoan, offset, pageSize: parseInt(pageSize) }, type: QueryTypes.SELECT });
        
        const [total] = await sequelize.query(
            `SELECT COUNT(*) as total FROM Lich_hen WHERE ma_tai_khoan = :ma_tai_khoan AND ma_trang_thai <> 'TT02'`,
            { replacements: { ma_tai_khoan }, type: QueryTypes.SELECT }
        );

        res.json({ 
            items: history, 
            totalItems: total.total, 
            page: parseInt(page), 
            pageSize: parseInt(pageSize) 
        });
    } catch (error) { res.status(500).json({ message: error.message }); }
};
/**
 * 3. DANH SÁCH ADMIN
 */
exports.getAdminBookings = async (req, res) => {
    try {
        // bóc tách các bộ lọc từ URL
        const { page = 1, pageSize = 10, status, date, search } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        
        // 1. Xử lý điều kiện WHERE động — chỉ lịch có bệnh nhân (họ tên hợp lệ trong Thong_tin_nguoi_dung)
        let whereClauses = [
            "NULLIF(LTRIM(RTRIM(bn.ho_ten)), N'') IS NOT NULL",
            "LTRIM(RTRIM(bn.ho_ten)) NOT IN (N'—', N'Chưa có trong hồ sơ')"
        ];
        let replacements = { offset, pageSize: parseInt(pageSize) };

        if (status) {
            whereClauses.push("lh.ma_trang_thai = :status");
            replacements.status = status;
        }
        if (date) {
            whereClauses.push("lh.ngay_kham = :date");
            replacements.date = date;
        }
        if (search) {
            whereClauses.push("(bn.ho_ten LIKE :search OR bs.ho_ten_bac_si LIKE :search)");
            replacements.search = `%${search}%`;
        }

        // Kết nối các điều kiện bằng chữ "AND"
        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        // 2. Chạy Query lấy dữ liệu
        const bookings = await sequelize.query(`
            SELECT lh.*, bn.ho_ten, bs.ho_ten_bac_si, tt.ten_trang_thai, k.ten_khoa,
                CONVERT(VARCHAR(5), lh.gio_bat_dau_kham, 108) as gio_kham_hien_thi
            FROM Lich_hen lh
            OUTER APPLY (
                SELECT TOP 1 t.ho_ten
                FROM Thong_tin_nguoi_dung t
                WHERE t.ma_tai_khoan = lh.ma_tai_khoan
                ORDER BY
                    CASE WHEN NULLIF(LTRIM(RTRIM(t.ho_ten)), N'') IS NOT NULL THEN 0 ELSE 1 END,
                    t.ma_nguoi_dung DESC
            ) bn
            JOIN Bac_si bs ON lh.ma_bac_si = bs.ma_bac_si
            JOIN Khoa k ON bs.ma_khoa = k.ma_khoa
            JOIN Trang_thai tt ON lh.ma_trang_thai = tt.ma_trang_thai
            ${whereString} -- Gắn bộ lọc vào đây
            ORDER BY lh.ngay_tao DESC
            OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY
        `, { 
            replacements, 
            type: QueryTypes.SELECT 
        });

        // 3. Đếm tổng số để làm phân trang
        const [total] = await sequelize.query(`
            SELECT COUNT(*) as total 
            FROM Lich_hen lh
            OUTER APPLY (
                SELECT TOP 1 t.ho_ten
                FROM Thong_tin_nguoi_dung t
                WHERE t.ma_tai_khoan = lh.ma_tai_khoan
                ORDER BY
                    CASE WHEN NULLIF(LTRIM(RTRIM(t.ho_ten)), N'') IS NOT NULL THEN 0 ELSE 1 END,
                    t.ma_nguoi_dung DESC
            ) bn
            JOIN Bac_si bs ON lh.ma_bac_si = bs.ma_bac_si
            ${whereString}
        `, { replacements, type: QueryTypes.SELECT });

        res.json({ 
            items: bookings, 
            totalItems: total.total,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
        });
    } catch (error) { res.status(500).json({ message: "Lỗi lọc lịch hẹn: " + error.message }); }
};

/**
 * 4. CHI TIẾT LỊCH HẸN
 */
exports.getBookingDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const detail = await sequelize.query(`
            SELECT 
                lh.ma_lich_hen, lh.ma_trang_thai, tt.ten_trang_thai, CONVERT(VARCHAR(19), lh.ngay_tao, 120) as ngay_tao,
                lh.ngay_kham, 
                CONVERT(VARCHAR(5), lh.gio_bat_dau_kham, 108) as gio_bat_dau_kham, 
                CONVERT(VARCHAR(5), lh.gio_ket_thuc_kham, 108) as gio_ket_thuc_kham,
                lh.mo_ta_trieu_chung,
                bn.ho_ten as benh_nhan,
                bn.so_dien_thoai,
                bn.ngay_sinh,
                bn.gioi_tinh,
                k.ma_khoa,
                k.ten_khoa as khoa, 
                bs.ma_bac_si,
                bs.chuyen_khoa as chuyen_khoa_bac_si,
                bs.ho_ten_bac_si as bac_si, 
                ph.ma_phong,
                ph.ten_phong
            FROM Lich_hen lh
            OUTER APPLY (
                SELECT TOP 1 t.ho_ten, t.so_dien_thoai, t.ngay_sinh, t.gioi_tinh
                FROM Thong_tin_nguoi_dung t
                WHERE t.ma_tai_khoan = lh.ma_tai_khoan
                ORDER BY
                    CASE WHEN NULLIF(LTRIM(RTRIM(t.ho_ten)), N'') IS NOT NULL THEN 0 ELSE 1 END,
                    t.ma_nguoi_dung DESC
            ) bn
            JOIN Bac_si bs ON lh.ma_bac_si = bs.ma_bac_si
            JOIN Khoa k ON bs.ma_khoa = k.ma_khoa
            JOIN Trang_thai tt ON lh.ma_trang_thai = tt.ma_trang_thai
            OUTER APPLY (
                SELECT TOP 1 llv2.ma_phong, pk.ten_phong
                FROM Lich_lam_viec llv2
                LEFT JOIN Phong_kham pk ON llv2.ma_phong = pk.ma_phong
                WHERE llv2.ma_bac_si = lh.ma_bac_si AND llv2.ngay_lam_viec = lh.ngay_kham
                ORDER BY llv2.gio_bat_dau
            ) ph
            WHERE lh.ma_lich_hen = :id
        `, { replacements: { id }, type: QueryTypes.SELECT });
        
        if (!detail.length) return res.status(404).json({ message: "Không tìm thấy lịch hẹn" });
        const r = detail[0];
        const pick = (a, ...alts) => {
            if (a !== undefined && a !== null && String(a).trim() !== "") return a;
            for (const x of alts) {
                if (x !== undefined && x !== null && String(x).trim() !== "") return x;
            }
            return a ?? alts[alts.length - 1] ?? null;
        };
        res.json({
            ...r,
            so_dien_thoai: pick(r.so_dien_thoai, r.SO_DIEN_THOAI, r.So_dien_thoai),
            ngay_sinh: pick(r.ngay_sinh, r.NGAY_SINH, r.Ngay_sinh),
            gioi_tinh: pick(r.gioi_tinh, r.GIOI_TINH, r.Gioi_tinh)
        });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

/**
 * 5. HỦY LỊCH HẸN (CHẶN TRƯỚC 2 TIẾNG)
 */
exports.cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const [booking] = await sequelize.query(
            `SELECT ngay_kham, CONVERT(VARCHAR(5), gio_bat_dau_kham, 108) as gio_bd FROM Lich_hen WHERE ma_lich_hen = :id`,
            { replacements: { id }, type: QueryTypes.SELECT }
        );
        if (!booking) return res.status(404).json({ message: "Mã lịch hẹn không tồn tại!" });

        const now = new Date();
        const appointmentTime = new Date(`${booking.ngay_kham}T${booking.gio_bd}:00`);
        const diffInHours = (appointmentTime - now) / (1000 * 60 * 60);

        if (diffInHours < 2) {
            return res.status(400).json({ message: "Chỉ được hủy lịch hẹn trước giờ khám ít nhất 2 tiếng!" });
        }

        await sequelize.query(`UPDATE Lich_hen SET ma_trang_thai = 'TT02', ngay_cap_nhat = GETDATE() WHERE ma_lich_hen = :id`, { replacements: { id } });
        res.json({ message: "Đã hủy lịch hẹn thành công!", ma_lich_hen: id, ma_trang_thai: 'TT02' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

/**
 * 6. CẬP NHẬT TRẠNG THÁI / DỜI LỊCH (CHẶN TRƯỚC 2 TIẾNG)
 */
exports.updateBooking = async (req, res) => {
    try {
        const { id } = req.params; 
        const { ngay_kham, gio_bat_dau_kham, ma_bac_si, ma_trang_thai, mo_ta_trieu_chung } = req.body;

        // 1. Lấy thông tin hiện tại
        const [current] = await sequelize.query(
            `SELECT ngay_kham, ma_bac_si, CONVERT(VARCHAR(5), gio_bat_dau_kham, 108) as gio_bd 
             FROM Lich_hen WHERE ma_lich_hen = :id`,
            { replacements: { id }, type: QueryTypes.SELECT }
        );

        if (!current) return res.status(404).json({ message: "Không tìm thấy lịch hẹn!" });

        const targetDate = ngay_kham || current.ngay_kham;
        const targetDoctor = ma_bac_si || current.ma_bac_si;
        const targetTime = gio_bat_dau_kham || current.gio_bd;

        // 2. 🛡️ CHẶN TRÙNG LỊCH (Giữ nguyên để đảm bảo bác sĩ không bị phân thân)
        if (ngay_kham || gio_bat_dau_kham || ma_bac_si) {
            const [conflict] = await sequelize.query(`
                SELECT ma_lich_hen FROM Lich_hen
                WHERE ma_bac_si = :targetDoctor 
                AND ngay_kham = :targetDate 
                AND gio_bat_dau_kham = :targetTime
                AND ma_lich_hen <> :id
                AND ma_trang_thai <> 'TT02'
            `, {
                replacements: { targetDoctor, targetDate, targetTime, id },
                type: QueryTypes.SELECT
            });

            if (conflict) {
                return res.status(400).json({ 
                    message: `Bác sĩ đã bận vào lúc ${targetTime} ngày ${targetDate}!` 
                });
            }
        }

        // 3. Tính lại giờ kết thúc (+30p)
        let gio_kt_final = null;
        if (targetTime) {
            const [h, m] = targetTime.split(':');
            const dateObj = new Date(2026, 0, 1, parseInt(h), parseInt(m));
            dateObj.setMinutes(dateObj.getMinutes() + 30);
            gio_kt_final = dateObj.toTimeString().substring(0, 5);
        }

        // 4. CẬP NHẬT (Không có ghi_chu_admin)
        await sequelize.query(`
            UPDATE Lich_hen 
            SET ma_bac_si = ISNULL(:ma_bs, ma_bac_si),
                ngay_kham = ISNULL(:ngay, ngay_kham),
                gio_bat_dau_kham = ISNULL(:gio_bd, gio_bat_dau_kham),
                gio_ket_thuc_kham = ISNULL(:gio_kt, gio_ket_thuc_kham),
                ma_trang_thai = ISNULL(:status, ma_trang_thai),
                mo_ta_trieu_chung = ISNULL(:mo_ta, mo_ta_trieu_chung),
                ngay_cap_nhat = GETDATE()
            WHERE ma_lich_hen = :id
        `, {
            replacements: {
                id,
                ma_bs: ma_bac_si || null,
                ngay: ngay_kham || null,
                gio_bd: gio_bat_dau_kham || null,
                gio_kt: gio_kt_final,
                status: ma_trang_thai || null,
                mo_ta: mo_ta_trieu_chung !== undefined ? mo_ta_trieu_chung : null
            }
        });

        res.json({ message: "Đã lưu thay đổi điều phối lịch hẹn!" });

    } catch (error) {
        res.status(500).json({ message: "Lỗi cập nhật: " + error.message });
    }
};
/**
 * 7. LẤY DANH SÁCH GIỜ ĐÃ BỊ CHIẾM
 * FE dùng để tô xám / disable slot đã có người đặt
 */
exports.getOccupiedSlots = async (req, res) => {
    try {
        const ma_bac_si = req.query.ma_bac_si || req.query.doctorId;
        const ngay_kham = req.query.ngay_kham || req.query.date;

        if (!ma_bac_si || !ngay_kham) {
            return res.status(400).json({
                message: "Thiếu doctorId (hoặc ma_bac_si) hoặc date (hoặc ngay_kham)!"
            });
        }

        const slots = await sequelize.query(`
            SELECT
                ma_lich_hen,
                CONVERT(VARCHAR(5), gio_bat_dau_kham, 108) AS gio_bat_dau_kham,
                CONVERT(VARCHAR(5), gio_ket_thuc_kham, 108) AS gio_ket_thuc_kham
            FROM Lich_hen
            WHERE ma_bac_si = :ma_bac_si
              AND ngay_kham = :ngay_kham
              AND ma_trang_thai = 'TT01'
            ORDER BY gio_bat_dau_kham
        `, {
            replacements: { ma_bac_si, ngay_kham },
            type: QueryTypes.SELECT
        });

        res.json({
            ma_bac_si,
            ngay_kham,
            occupiedSlots: slots
        });
    } catch (error) {
        res.status(500).json({
            message: "Lỗi lấy danh sách giờ đã đặt: " + error.message
        });
    }
};


/**
 * 8. LẤY DANH SÁCH GIỜ CÒN TRỐNG
 * FE dùng để render available = true/false
 */
exports.getAvailableSlots = async (req, res) => {
    try {
        const ma_bac_si = req.query.ma_bac_si || req.query.doctorId;
        const ngay_kham = req.query.ngay_kham || req.query.date;

        if (!ma_bac_si || !ngay_kham) {
            return res.status(400).json({
                message: "Thiếu doctorId (hoặc ma_bac_si) hoặc date (hoặc ngay_kham)!"
            });
        }

        // Có thể đổi mảng này theo khung giờ thực tế của phòng khám
        const allSlots = [
            "07:00", "07:30", "08:00", "08:30",
            "09:00", "09:30", "10:00", "10:30",
            "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"
        ];

        const booked = await sequelize.query(`
            SELECT CONVERT(VARCHAR(5), gio_bat_dau_kham, 108) AS time
            FROM Lich_hen
            WHERE ma_bac_si = :ma_bac_si
              AND ngay_kham = :ngay_kham
              AND ma_trang_thai = 'TT01'
            ORDER BY gio_bat_dau_kham
        `, {
            replacements: { ma_bac_si, ngay_kham },
            type: QueryTypes.SELECT
        });

        const bookedTimes = booked.map(item => item.time);

        const result = allSlots.map(time => ({
            time,
            available: !bookedTimes.includes(time)
        }));

        res.json({
            ma_bac_si,
            ngay_kham,
            slots: result
        });
    } catch (error) {
        res.status(500).json({
            message: "Lỗi lấy danh sách khung giờ: " + error.message
        });
    }
};