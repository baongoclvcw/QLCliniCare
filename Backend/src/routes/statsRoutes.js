const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

router.get('/summary', statsController.getSummaryStats);
router.get('/growth', statsController.getGrowthChart);
router.get('/activities', statsController.getRecentActivities);
router.get('/today-doctors', statsController.getTodayDoctors);
router.get('/upcoming-bookings', statsController.getUpcomingBookings);

module.exports = router;