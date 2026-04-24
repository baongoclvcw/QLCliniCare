const { Account, Role, UserInfo } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * 1. ĐĂNG KÝ (Bổ sung ràng buộc mật khẩu >= 6 ký tự)
 */
exports.register = async (req, res) => {
    const t = await Account.sequelize.transaction();
    try {
        const { email, password, fullName, phone } = req.body;

        // 🛡️ Ràng buộc: Kiểm tra độ dài mật khẩu
        if (!password || password.length < 6) {
            return res.status(400).json({ 
                message: "Mật khẩu không hợp lệ! Vui lòng nhập ít nhất 6 ký tự." 
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const ma_tk = 'TK' + Date.now().toString().slice(-5);
        const ma_nd = 'ND' + Date.now().toString().slice(-5);

        const account = await Account.create({
            ma_tai_khoan: ma_tk,
            email,
            mat_khau: hashedPassword,
            ma_vai_tro: 'VT02' // Mặc định là Bệnh nhân
        }, { transaction: t });

        const userInfo = await UserInfo.create({
            ma_nguoi_dung: ma_nd,
            ho_ten: fullName,
            so_dien_thoai: phone,
            ma_tai_khoan: ma_tk
        }, { transaction: t });

        await t.commit();
        res.status(201).json({ 
            message: "Đăng ký thành công!", 
            user: { id: ma_tk, fullName, role: 'VT02' } 
        });
    } catch (error) {
        if (t) await t.rollback();
        res.status(500).json({ message: "Lỗi đăng ký: " + error.message });
    }
};

/**
 * 2. KIỂM TRA TỒN TẠI
 */
exports.checkExists = async (req, res) => {
    try {
        const { email, phone } = req.query;
        if (email) {
            const acc = await Account.findOne({ where: { email } });
            return res.json({ exists: !!acc, field: 'email' });
        }
        if (phone) {
            const info = await UserInfo.findOne({ where: { so_dien_thoai: phone } });
            return res.json({ exists: !!info, field: 'phone' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * 3. ĐĂNG NHẬP
 * Body chuẩn: { email, password }
 * Tương thích cũ: { email, mat_khau }
 */
exports.login = async (req, res) => {
    try {
        const { email, password, mat_khau } = req.body;
        const plainPassword = password != null ? password : mat_khau;

        const user = await Account.findOne({
            where: { email },
            include: [
                { model: Role, attributes: ['ten_vai_tro'] },
                { model: UserInfo, attributes: ['ho_ten'] }
            ]
        });

        if (!user || plainPassword == null || !(await bcrypt.compare(plainPassword, user.mat_khau))) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác!' });
        }

        const accessToken = jwt.sign(
            { id: user.ma_tai_khoan, role: user.ma_vai_tro },
            process.env.JWT_SECRET || 'CLINICARE_SECRET_KEY',
            { expiresIn: '1d' }
        );

        res.json({
            accessToken,
            user: { 
                id: user.ma_tai_khoan, 
                fullName: user.UserInfo?.ho_ten || 'User', 
                role: user.ma_vai_tro,
                roleName: user.Role?.ten_vai_tro
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi đăng nhập: " + error.message });
    }
};

/**
 * 4. LẤY HỒ SƠ & PROFILE (cần Bearer token; ma_tai_khoan = req.user.id)
 */
exports.getProfile = async (req, res) => {
    try {
        const ma_tai_khoan = req.user.id;

        const user = await UserInfo.findOne({
            where: { ma_tai_khoan },
            include: [{
                model: Account,
                attributes: ['email', 'ma_vai_tro'],
                include: [{ model: Role, attributes: ['ten_vai_tro'] }]
            }]
        });

        if (!user) return res.status(404).json({ message: "Không tìm thấy hồ sơ!" });

        res.json({
            ho_ten: user.ho_ten,
            email: user.Account?.email,
            so_dien_thoai: user.so_dien_thoai,
            gioi_tinh: user.gioi_tinh,
            ngay_sinh: user.ngay_sinh,
            dia_chi: user.dia_chi,
            cccd: user.cccd,
            chieu_cao: user.chieu_cao,
            can_nang: user.can_nang,
            nhom_mau: user.nhom_mau,
            tien_su_benh: user.tien_su_benh,
            di_ung: user.di_ung,
            ghi_chu: user.ghi_chu,
            ten_vai_tro: user.Account?.Role?.ten_vai_tro
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy hồ sơ: " + error.message });
    }
};

/**
 * 5. CẬP NHẬT HỒ SƠ (cần Bearer token)
 */
exports.updateProfile = async (req, res) => {
    try {
        const ma_tai_khoan = req.user.id;

        const ho_so = await UserInfo.findOne({ where: { ma_tai_khoan } });
        if (!ho_so) return res.status(404).json({ message: "Không tìm thấy hồ sơ!" });

        const d = req.body;

        const updateData = {
            ho_ten: d.ho_ten !== undefined ? d.ho_ten : ho_so.ho_ten,
            so_dien_thoai: d.so_dien_thoai !== undefined ? d.so_dien_thoai : ho_so.so_dien_thoai,
            gioi_tinh: d.gioi_tinh !== undefined ? d.gioi_tinh : ho_so.gioi_tinh,
            ngay_sinh: d.ngay_sinh !== undefined ? d.ngay_sinh : ho_so.ngay_sinh,
            dia_chi: d.dia_chi !== undefined ? d.dia_chi : ho_so.dia_chi,
            cccd: d.cccd !== undefined ? d.cccd : ho_so.cccd,
            chieu_cao: d.chieu_cao ? parseFloat(d.chieu_cao) : ho_so.chieu_cao,
            can_nang: d.can_nang ? parseFloat(d.can_nang) : ho_so.can_nang,
            nhom_mau: d.nhom_mau !== undefined ? d.nhom_mau : ho_so.nhom_mau,
            tien_su_benh: d.tien_su_benh !== undefined ? d.tien_su_benh : ho_so.tien_su_benh,
            di_ung: d.di_ung !== undefined ? d.di_ung : ho_so.di_ung,
            ghi_chu: d.ghi_chu !== undefined ? d.ghi_chu : ho_so.ghi_chu
        };

        await ho_so.update(updateData);

        res.json({ 
            message: "Cập nhật hồ sơ thành công!",
            ho_ten: ho_so.ho_ten
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi cập nhật: " + error.message });
    }
};

/**
 * 6. ĐĂNG XUẤT
 */
exports.logout = async (req, res) => {
    res.status(200).json({ message: "Đăng xuất thành công!" });
};