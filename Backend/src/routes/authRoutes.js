const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

/* =========================================================
    1. QUẢN LÝ TÀI KHOẢN (ĐĂNG KÝ, ĐĂNG NHẬP)
   ========================================================= */
// Đăng ký tài khoản mới
router.post('/register', authController.register);

// Kiểm tra email hoặc số điện thoại đã tồn tại chưa
router.get('/check-exists', authController.checkExists);

// Đăng nhập hệ thống
router.post('/login', authController.login);

// Đăng xuất
router.post('/logout', authController.logout);

/* =========================================================
    2. QUẢN LÝ HỒ SƠ & PROFILE (MODULE D - BỆNH NHÂN)
   ========================================================= */
// Hồ sơ: bắt buộc Bearer token (ma_tai_khoan lấy từ JWT)
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile); 

module.exports = router;