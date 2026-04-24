const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Role = sequelize.define('Role', {
    ma_vai_tro: { type: DataTypes.STRING(10), primaryKey: true },
    ten_vai_tro: { type: DataTypes.STRING(50), allowNull: false }
}, { tableName: 'Vai_tro', timestamps: false });

module.exports = Role;