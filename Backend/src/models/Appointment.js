const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Appointment = sequelize.define('Appointment', {
    ma_lich_hen: { type: DataTypes.STRING, primaryKey: true },
    ngay_kham: { type: DataTypes.DATEONLY },
    gio_bat_dau_kham: { type: DataTypes.TIME },
    gio_ket_thuc_kham: { type: DataTypes.TIME },
    mo_ta_trieu_chung: { type: DataTypes.TEXT },
    ma_trang_thai: { type: DataTypes.STRING },
    ma_tai_khoan: { type: DataTypes.STRING },
    ma_bac_si: { type: DataTypes.STRING },
    ma_khung_gio: { type: DataTypes.STRING },
    ngay_tao: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'Lich_hen', // Khớp với tên bảng trong SQL của Nhi
    timestamps: false
});

module.exports = Appointment;