const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const UserInfo = sequelize.define('UserInfo', {
    ma_nguoi_dung: { 
        type: DataTypes.STRING(10), 
        primaryKey: true 
    },
    ho_ten: { 
        type: DataTypes.STRING(100), 
        allowNull: false 
    }, 
    so_dien_thoai: { 
        type: DataTypes.STRING(15) 
    },
    gioi_tinh: { 
        type: DataTypes.STRING(10) 
    },
    ngay_sinh: { 
        type: DataTypes.DATEONLY // DATEONLY tương ứng với kiểu DATE trong SQL
    },
    dia_chi: { 
        type: DataTypes.TEXT 
    },
    cccd: { 
        type: DataTypes.STRING(20) 
    },
    chieu_cao: { 
        type: DataTypes.FLOAT 
    },
    can_nang: { 
        type: DataTypes.FLOAT 
    },
    nhom_mau: { 
        type: DataTypes.STRING(5) 
    },
    tien_su_benh: { 
        type: DataTypes.TEXT 
    },
    di_ung: { 
        type: DataTypes.TEXT 
    },
    ghi_chu: { 
        type: DataTypes.TEXT 
    },
    ma_tai_khoan: { 
        type: DataTypes.STRING(10), 
        allowNull: false 
    }
}, { 
    tableName: 'Thong_tin_nguoi_dung', 
    timestamps: false 
});

module.exports = UserInfo;