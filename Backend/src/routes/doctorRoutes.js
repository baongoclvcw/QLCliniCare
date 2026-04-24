const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

/* =========================================================
   QUẢN LÝ BÁC SĨ (MODULE E & ADMIN)
   Lưu ý: đăng ký /admin/* TRƯỚC /:id để không bị coi id = "admin"
   ========================================================= */

router.get('/', doctorController.getDoctors);
router.post('/', doctorController.createDoctor);

router.post('/admin/config/working-hours', doctorController.configWorkingHours);
router.get('/admin/schedules', doctorController.getSchedules);

router.get('/:id', doctorController.getDoctorById);
router.put('/:id', doctorController.updateDoctor);
router.delete('/:id', doctorController.deleteDoctor);

module.exports = router;
