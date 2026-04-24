const { Bac_si, Khoa, sequelize } = require('../models');
const { Op, QueryTypes } = require('sequelize');

/**
 * 1. LẤY DANH SÁCH BÁC SĨ (Module D & A)
 * - Lọc theo khoa (dept_id)
 * - Tìm kiếm theo tên (search)
 * - Lấy bác sĩ nổi bật (featured=true)
 */
exports.getDoctors = async (req, res) => {
    try {
        const { featured, search } = req.query;
        const dept_id = req.query.dept_id || req.query.ma_khoa;
        
        // TRANG CHỦ: Lấy bác sĩ nổi bật
        if (featured === 'true') {
            const featuredDoctors = await sequelize.query(`
                SELECT TOP 5 bs.ma_bac_si, bs.ho_ten_bac_si, bs.chuyen_khoa, k.ten_khoa
                FROM Bac_si bs
                JOIN Khoa k ON bs.ma_khoa = k.ma_khoa
                ORDER BY bs.so_nam_kinh_nghiem DESC
            `, { type: QueryTypes.SELECT });
            return res.json(featuredDoctors);
        }

        // GRID DANH SÁCH: Lọc và Tìm kiếm
        let whereClause = {};
        if (dept_id) whereClause.ma_khoa = dept_id;
        if (search) whereClause.ho_ten_bac_si = { [Op.like]: `%${search}%` };

        const doctors = await Bac_si.findAll({
            where: whereClause,
            include: [{ model: Khoa, as: 'Department', attributes: ['ten_khoa'] }]
        });

        const result = doctors.map(doc => ({
            ma_bac_si: doc.ma_bac_si,
            ma_khoa: doc.ma_khoa,
            ho_ten_bac_si: doc.ho_ten_bac_si,
            chuyen_khoa: doc.chuyen_khoa,
            so_dien_thoai: doc.so_dien_thoai,
            email: doc.email,
            chuc_danh: doc.chuc_danh,
            so_nam_kinh_nghiem: doc.so_nam_kinh_nghiem,
            ngay_sinh: doc.ngay_sinh,
            gioi_tinh: doc.gioi_tinh,
            dia_chi: doc.dia_chi,
            mo_ta_kinh_nghiem: doc.mo_ta_kinh_nghiem,
            ten_khoa: doc.Department?.ten_khoa
        }));

        res.json({ items: result });
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy danh sách: " + error.message });
    }
};

/**
 * 2. LẤY CHI TIẾT 1 BÁC SĨ (Module E)
 */
exports.getDoctorById = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.query; // Nhận role từ URL (ví dụ: ?role=patient)

        const doctor = await Bac_si.findOne({
            where: { ma_bac_si: id },
            include: [{ model: Khoa, as: 'Department', attributes: ['ten_khoa'] }]
        });

        if (!doctor) return res.status(404).json({ message: "Không tìm thấy bác sĩ!" });

        // Lấy giờ làm việc
        const workingHours = await sequelize.query(`
            SELECT TOP 1 
                CONVERT(VARCHAR(5), gio_sang_bat_dau, 108) as sang_bd, 
                CONVERT(VARCHAR(5), gio_sang_ket_thuc, 108) as sang_kt, 
                CONVERT(VARCHAR(5), gio_chieu_bat_dau, 108) as chieu_bd, 
                CONVERT(VARCHAR(5), gio_chieu_ket_thuc, 108) as chieu_kt,
                ghi_chu
            FROM Cau_hinh_gio_lam_bac_si
            WHERE ma_bac_si = :id AND trang_thai = N'Đang áp dụng'
            ORDER BY ngay_hieu_luc DESC
        `, { replacements: { id }, type: QueryTypes.SELECT });

        // CHUYỂN DỮ LIỆU SANG OBJECT THƯỜNG ĐỂ XỬ LÝ
        let result = {
            ...doctor.get({ plain: true }),
            ten_khoa: doctor.Department?.ten_khoa || 'Chưa xác định',
            gio_lam_viec: workingHours[0] || null
        };

        // --- 🛡️ LOGIC PHÂN QUYỀN HIỂN THỊ ---
        if (role === 'patient') {
            delete result.email;
            delete result.so_dien_thoai;
            delete result.dia_chi;
            delete result.Department;
        }

        res.json(result);
    } catch (error) { 
        res.status(500).json({ message: "Lỗi lấy chi tiết bác sĩ: " + error.message }); 
    }
};

/**
 * 3. THÊM MỚI BÁC SĨ (Admin)
 */
exports.createDoctor = async (req, res) => {
    try {
        const d = req.body;
        const ma_bs = 'BS' + Date.now().toString().slice(-4);
        const newDoctor = await Bac_si.create({ ...d, ma_bac_si: ma_bs });
        res.status(201).json({ 
            message: "Thêm bác sĩ thành công!", 
            ma_bac_si: newDoctor.ma_bac_si,
            ho_ten_bac_si: newDoctor.ho_ten_bac_si 
        });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

/**
 * 4. CHỈNH SỬA THÔNG TIN BÁC SĨ (Admin - PUT)
 */
exports.updateDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        await Bac_si.update(req.body, { where: { ma_bac_si: id } });
        res.json({ message: "Lưu thay đổi info bác sĩ thành công!" });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

/**
 * 5. XÓA BÁC SĨ (Admin)
 */
exports.deleteDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        await Bac_si.destroy({ where: { ma_bac_si: id } });
        res.json({ message: "Xóa bác sĩ thành công!" });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

/**
 * 6. CHỈNH SỬA GIỜ LÀM (Module E - Admin)
 * Dùng chung logic với POST /api/schedules/admin/config/working-hours (upsert + sp, tránh trùng UIX).
 */
const scheduleController = require('./scheduleController');
exports.configWorkingHours = scheduleController.configWorkingHours;

/**
 * 7. XEM LỊCH LÀM VIỆC THỰC TẾ (Module E - Admin)
 */
exports.getSchedules = async (req, res) => {
    try {
        const doctorId = req.query.doctorId || req.query.ma_bac_si;
        if (!doctorId) {
            return res.status(400).json({ message: "Vui lòng cung cấp doctorId hoặc ma_bac_si!" });
        }
        const schedules = await sequelize.query(`
            SELECT ngay_lam_viec, ma_phong, ca_lam 
            FROM Lich_lam_viec 
            WHERE ma_bac_si = :doctorId
            ORDER BY ngay_lam_viec DESC
        `, { replacements: { doctorId }, type: QueryTypes.SELECT });

        res.json({ items: schedules });
    } catch (error) { res.status(500).json({ message: error.message }); }
};