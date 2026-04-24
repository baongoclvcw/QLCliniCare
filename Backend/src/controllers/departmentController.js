const { Khoa, Bac_si } = require('../models');
const { Op } = require('sequelize');

/**
 * 1. LẤY DANH SÁCH KHOA (Module A & D)
 * Hỗ trợ tìm kiếm theo tên khoa hoặc tên trưởng khoa
 */
exports.getAllDepartments = async (req, res) => {
    try {
        const { search } = req.query;
        let whereCondition = {};

        if (search) {
            whereCondition = {
                [Op.or]: [
                    { ten_khoa: { [Op.like]: `%${search}%` } },
                    // Lưu ý: Chỉ dùng dòng dưới nếu Nhi đã định nghĩa association trong Models
                    { '$Bac_si_TruongKhoa.ho_ten_bac_si$': { [Op.like]: `%${search}%` } }
                ]
            };
        }

        const departments = await Khoa.findAll({
            where: whereCondition,
            include: [{ 
                model: Bac_si, 
                as: 'Bac_si_TruongKhoa', // Đảm bảo trong models/index.js cũng dùng alias này
                attributes: ['ho_ten_bac_si'] 
            }],
            attributes: ['ma_khoa', 'ten_khoa', 'ma_bac_si'] // Chỉ lấy các cột cần thiết
        });

        // Map lại dữ liệu gọn đẹp cho FE
        const result = departments.map(d => ({
            ma_khoa: d.ma_khoa,
            ten_khoa: d.ten_khoa,
            truong_khoa: d.Bac_si_TruongKhoa?.ho_ten_bac_si || 'Chưa có'
        }));

        res.json(result);
    } catch (error) { 
        res.status(500).json({ message: "Lỗi lấy danh sách khoa: " + error.message }); 
    }
};

/**
 * 2. TẠO KHOA MỚI (Admin)
 */
exports.createDepartment = async (req, res) => {
    try {
        const { ten_khoa, ma_bac_si, ma_khoa: clientMa } = req.body;
        if (!ten_khoa || !String(ten_khoa).trim()) {
            return res.status(400).json({ message: "Thiếu tên khoa." });
        }
        let ma_khoa = clientMa && String(clientMa).trim() ? String(clientMa).trim() : ('K' + Date.now().toString().slice(-4));
        const exists = await Khoa.findOne({ where: { ma_khoa } });
        if (exists) {
            return res.status(400).json({ message: "Mã khoa đã tồn tại. Vui lòng chọn mã khác." });
        }

        const newDept = await Khoa.create({
            ma_khoa,
            ten_khoa: String(ten_khoa).trim(),
            ma_bac_si: ma_bac_si || null
        });
        
        res.status(201).json({ 
            message: "Tạo khoa thành công!", 
            ma_khoa: newDept.ma_khoa,
            ten_khoa: newDept.ten_khoa 
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi tạo khoa: " + error.message });
    }
};

/**
 * 3. CẬP NHẬT KHOA (Admin)
 */
exports.updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { ten_khoa, ma_bac_si } = req.body;
        
        const [updated] = await Khoa.update(
            { ten_khoa, ma_bac_si: ma_bac_si || null },
            { where: { ma_khoa: id } }
        );
        
        if (updated === 0) return res.status(404).json({ message: "Không tìm thấy khoa để cập nhật" });
        res.json({ message: "Cập nhật khoa thành công!" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi cập nhật khoa: " + error.message });
    }
};

/**
 * 4. XÓA KHOA (Admin)
 */
exports.deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Khoa.destroy({ where: { ma_khoa: id } });
        
        if (deleted === 0) return res.status(404).json({ message: "Không tìm thấy khoa để xóa" });
        res.json({ message: "Xóa khoa thành công!" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi xóa khoa: " + error.message });
    }
};