const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Department = sequelize.define('Department', {
    ma_khoa: { type: DataTypes.STRING(10), primaryKey: true },
    ten_khoa: { type: DataTypes.STRING(100), allowNull: false },
    ma_bac_si: { type: DataTypes.STRING(10), allowNull: true } // Trưởng khoa
}, { tableName: 'Khoa', timestamps: false });

module.exports = Department;