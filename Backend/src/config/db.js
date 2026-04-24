const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME, 
    process.env.DB_USER, 
    process.env.DB_PASS, 
    {
        host: '127.0.0.1', 
        port: 1433, // Cổng mặc định chúng ta vừa cấu hình trong SQL Server
        dialect: 'mssql',
        dialectOptions: {
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        },
        logging: false 
    }
);

module.exports = sequelize;