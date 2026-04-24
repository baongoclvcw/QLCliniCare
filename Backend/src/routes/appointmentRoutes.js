const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authMiddleware } = require('../middleware/authMiddleware');

// 1. DÀNH CHO BỆNH NHÂN
router.post('/', appointmentController.createAppointment);
router.get('/me', authMiddleware, appointmentController.getMyHistory);

// API lấy slot còn trống / đã đặt
router.get('/available-slots', appointmentController.getAvailableSlots);
router.get('/occupied-slots', appointmentController.getOccupiedSlots);

// 2. DÀNH CHO ADMIN
router.get('/admin/bookings', appointmentController.getAdminBookings);

// 3. CHI TIẾT & THAO TÁC CHUNG
router.get('/:id', appointmentController.getBookingDetail);
router.put('/:id', appointmentController.updateBooking);
router.patch('/:id/cancel', appointmentController.cancelBooking);

module.exports = router;