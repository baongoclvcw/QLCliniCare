const express = require('express');
const cors = require('cors');
require('dotenv').config();
const sequelize = require('./config/db');

// --- 1. IMPORT ROUTES ---
const authRoutes = require('./routes/authRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes'); 
const statsRoutes = require('./routes/statsRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');

const app = express();

// --- 2. THIẾT LẬP MIDDLEWARE ---
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// --- 3. ĐĂNG KÝ CÁC ĐƯỜNG DẪN API ---

// Auth (Login, Register, Profile)
app.use('/api/auth', authRoutes);

// Quản lý khoa (Module C)
app.use('/api/departments', departmentRoutes);

// Quản lý bác sĩ (Module D & E)
app.use('/api/doctors', doctorRoutes);

// Quản lý lịch làm việc (Module E & F)
app.use('/api/schedules', scheduleRoutes);

// Quản lý lịch hẹn Admin (Module G)
app.use('/api/bookings', appointmentRoutes); 

// Dashboard & Thống kê Admin (Module H)
// Chỉ cần 1 dòng này để quản lý: /summary, /growth, /activities, /today-doctors...
app.use('/api/admin/stats', statsRoutes);

// Proxy tới ChatbotAI (Flask), mặc định http://127.0.0.1:5001 — tránh trùng cổng với Node (5000)
app.use('/api/chatbot', chatbotRoutes);

// --- 4. KHỞI CHẠY SERVER ---
const startServer = async () => {
    try {
        await sequelize.authenticate();
        const PORT = process.env.PORT || 5000;

        app.listen(PORT, () => {
            console.log('-------------------------------------------');
            console.log('🚀 CLINICARE SYSTEM - SERVER STARTED');
            console.log('✅ Đã kết nối SQL Server thành công.');              
            console.log('📂 Database: ' + process.env.DB_NAME);
            console.log('-------------------------------------------');
            console.log(`🌐 URL: http://localhost:${PORT}`);
            console.log(`📊 Dashboard: /api/admin/stats/summary`);
            console.log(`🎟️ Lịch hẹn:  /api/bookings/admin/bookings`);
            console.log('-------------------------------------------');
        });
    } catch (error) {
        console.log('-------------------------------------------');
        console.error('❌ LỖI KẾT NỐI SQL SERVER!');
        console.error('Chi tiết:', error.message);
        console.log('-------------------------------------------');
    }
};

startServer();