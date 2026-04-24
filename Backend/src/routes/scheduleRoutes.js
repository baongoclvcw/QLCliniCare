const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

/* =========================================================
    1. DÀNH CHO BỆNH NHÂN (MODULE B - ĐẶT LỊCH)
   ========================================================= */

// API quan trọng: Lấy các khung giờ trống để chọn lúc đặt lịch
// URL: GET http://localhost:5000/api/schedules/slots?doctorId=BS01&date=2026-04-10
router.get('/slots', scheduleController.getAvailableSlots);


/* =========================================================
    2. DÀNH CHO ADMIN (MODULE E & F - QUẢN LÝ LỊCH)
   ========================================================= */

// Xem danh sách lịch làm việc thực tế của bác sĩ
// URL: GET http://localhost:5000/api/schedules?doctorId=BS01
router.get('/', scheduleController.getSchedules);

// Tạo / Sửa lịch làm việc thủ công (Gán ca thực tế)
router.post('/', scheduleController.createManualSchedule);

// Chỉnh sửa cấu hình giờ làm & Tái tạo lịch cho 1 bác sĩ
router.post('/admin/config/working-hours', scheduleController.configWorkingHours);

// Sinh lịch mặc định hàng loạt cho TẤT CẢ bác sĩ
router.post('/admin/schedules/generate', scheduleController.generateSchedules);

module.exports = router;