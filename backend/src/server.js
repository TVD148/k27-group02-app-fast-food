const app = require('./app');
require('dotenv').config();

// Đọc cổng chạy từ biến môi trường, mặc định là 5000
const PORT = process.env.PORT || 5000;

// Khởi chạy server lắng nghe các kết nối từ thiết bị di động / client
app.listen(PORT, () => {
  console.log('===================================================');
  console.log(`Server Backend đang hoạt động tại cổng: ${PORT}`);
  console.log(`Kiểm tra API tại địa chỉ: http://localhost:${PORT}`);
  console.log('===================================================');
});
