const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Account = sequelize.define('Account', {
    ma_tai_khoan: { type: DataTypes.STRING(10), primaryKey: true },
    email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    // DB chính (clinicare script): cột cho phép NULL — cho phép khớp dữ liệu import/legacy
    mat_khau: { type: DataTypes.STRING(255), allowNull: true },
    ma_vai_tro: { type: DataTypes.STRING(10), allowNull: false }
}, { tableName: 'Tai_khoan', timestamps: false });

module.exports = Account;