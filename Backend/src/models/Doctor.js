const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Doctor = sequelize.define('Doctor', {
    ma_bac_si: { 
        type: DataTypes.STRING(10), 
        primaryKey: true 
    },
    ho_ten_bac_si: { 
        type: DataTypes.STRING(100), 
        allowNull: false 
    },
    gioi_tinh: { 
        type: DataTypes.STRING(10) 
    },
    ngay_sinh: { 
        type: DataTypes.DATEONLY 
    },
    so_dien_thoai: { 
        type: DataTypes.STRING(15) 
    },
    email: { 
        type: DataTypes.STRING(100) 
    },
    chuc_danh: { 
        type: DataTypes.STRING(100), 
        allowNull: false 
    },
    chuyen_khoa: { 
        type: DataTypes.STRING(100) 
    },
    so_nam_kinh_nghiem: { 
        type: DataTypes.INTEGER 
    },
    dia_chi: { 
        type: DataTypes.TEXT 
    },
    mo_ta_kinh_nghiem: { 
        type: DataTypes.TEXT 
    },
    ma_khoa: { 
        type: DataTypes.STRING(10), 
        allowNull: false 
    }
}, { 
    tableName: 'Bac_si', 
    timestamps: false 
});

module.exports = Doctor;