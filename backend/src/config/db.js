const mysql = require('mysql2');
require('dotenv').config();

// Khởi tạo connection pool tới MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'fastfood_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

const promisePool = pool.promise();

// Kiểm tra kết nối ban đầu
promisePool.getConnection()
  .then(connection => {
    console.log('=== KẾT NỐI DATABASE MYSQL THÀNH CÔNG ===');
    connection.release();
  })
  .catch(err => {
    console.error('=== KẾT NỐI DATABASE THẤT BẠI ===');
    console.error('Chi tiết lỗi:', err.message);
  });

module.exports = promisePool;
