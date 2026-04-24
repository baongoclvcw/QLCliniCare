const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/* =========================================================
    1. IMPORT CÁC MODELS ĐÃ CÓ FILE LẺ
   ========================================================= */
const Account = require('./Account');
const Role = require('./Role');
const Doctor = require('./Doctor');
const Department = require('./Department');
const UserInfo = require('./UserInfo');

/* =========================================================
    2. KHAI BÁO TRỰC TIẾP CÁC MODEL CHƯA CÓ FILE
   ========================================================= */

// Khớp bảng Lich_hen trong clinicare script.sql / CLINICARE_GROUP2
const Appointment = sequelize.define('Appointment', {
    ma_lich_hen: { type: DataTypes.STRING(10), primaryKey: true },
    ngay_kham: { type: DataTypes.DATEONLY, allowNull: false },
    mo_ta_trieu_chung: { type: DataTypes.TEXT, allowNull: true },
    ma_tai_khoan: { type: DataTypes.STRING(10), allowNull: false },
    ma_khung_gio: { type: DataTypes.STRING(10), allowNull: false },
    ma_bac_si: { type: DataTypes.STRING(10), allowNull: false },
    ma_trang_thai: { type: DataTypes.STRING(10), allowNull: false },
    ngay_tao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ngay_cap_nhat: { type: DataTypes.DATE, allowNull: true },
    gio_bat_dau_kham: { type: DataTypes.TIME, allowNull: false },
    gio_ket_thuc_kham: { type: DataTypes.TIME, allowNull: false }
}, { tableName: 'Lich_hen', timestamps: false });

// Khớp Lich_lam_viec: PK là ma_lich_lam (IDENTITY), không phải ma_lich_lam_viec
const Schedule = sequelize.define('Schedule', {
    ma_lich_lam: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ngay_lam_viec: { type: DataTypes.DATEONLY, allowNull: false },
    gio_bat_dau: { type: DataTypes.TIME, allowNull: false },
    gio_ket_thuc: { type: DataTypes.TIME, allowNull: false },
    ca_lam: { type: DataTypes.STRING(20), allowNull: false },
    ma_bac_si: { type: DataTypes.STRING(10), allowNull: false },
    ma_phong: { type: DataTypes.STRING(10), allowNull: false }
}, { tableName: 'Lich_lam_viec', timestamps: false });

// Khớp Cau_hinh_gio_lam_bac_si
const WorkingConfig = sequelize.define('WorkingConfig', {
    ma_cau_hinh: { type: DataTypes.STRING(10), primaryKey: true },
    ma_bac_si: { type: DataTypes.STRING(10), allowNull: false },
    ngay_hieu_luc: { type: DataTypes.DATEONLY, allowNull: false },
    gio_sang_bat_dau: { type: DataTypes.TIME, allowNull: false },
    gio_sang_ket_thuc: { type: DataTypes.TIME, allowNull: false },
    gio_chieu_bat_dau: { type: DataTypes.TIME, allowNull: false },
    gio_chieu_ket_thuc: { type: DataTypes.TIME, allowNull: false },
    trang_thai: { type: DataTypes.STRING(20), allowNull: false },
    ngay_tao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ngay_cap_nhat: { type: DataTypes.DATE, allowNull: true },
    ghi_chu: { type: DataTypes.STRING(255), allowNull: true }
}, { tableName: 'Cau_hinh_gio_lam_bac_si', timestamps: false });


/* =========================================================
    3. THIẾT LẬP QUAN HỆ (ASSOCIATIONS)
   ========================================================= */
Account.belongsTo(Role, { foreignKey: 'ma_vai_tro' });
Role.hasMany(Account, { foreignKey: 'ma_vai_tro' });

Account.hasOne(UserInfo, { foreignKey: 'ma_tai_khoan' });
UserInfo.belongsTo(Account, { foreignKey: 'ma_tai_khoan' });

Doctor.belongsTo(Department, { foreignKey: 'ma_khoa', as: 'Department' });
Department.hasMany(Doctor, { foreignKey: 'ma_khoa', as: 'Doctors' });
Department.belongsTo(Doctor, { foreignKey: 'ma_bac_si', as: 'Bac_si_TruongKhoa' });

Doctor.hasMany(Schedule, { foreignKey: 'ma_bac_si', as: 'Schedules' });
Schedule.belongsTo(Doctor, { foreignKey: 'ma_bac_si' });

Appointment.belongsTo(Doctor, { foreignKey: 'ma_bac_si', as: 'Doctor' });
Appointment.belongsTo(Account, { foreignKey: 'ma_tai_khoan', as: 'PatientAccount' });

Doctor.hasOne(WorkingConfig, { foreignKey: 'ma_bac_si', as: 'WorkingConfig' });
WorkingConfig.belongsTo(Doctor, { foreignKey: 'ma_bac_si' });


/* =========================================================
    4. XUẤT MODELS
   ========================================================= */
module.exports = {
    sequelize, 
    Account,
    Role,
    Doctor,
    Bac_si: Doctor,
    Department,
    Khoa: Department,
    UserInfo,
    Appointment,
    Lich_hen: Appointment,
    Schedule,
    Lich_lam_viec: Schedule,
    WorkingConfig
};