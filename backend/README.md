# Backend - Ứng Dụng Đặt Thức Ăn Nhanh

Thư mục này chứa toàn bộ source code Backend của ứng dụng, chịu trách nhiệm xử lý các API nghiệp vụ, xác thực người dùng và kết nối cơ sở dữ liệu.

## Công nghệ sử dụng
*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Database Connector:** MySQL2 / Sequelize (ORM)
*   **Authentication:** JSON Web Tokens (JWT) & bcrypt (mã hóa mật khẩu)

## Phân công thực hiện
*   **Người phụ trách:** Trần Văn Đình
*   **Nhánh Git:** `backend`

## Cách khởi chạy dự án (phác thảo)
1. Di chuyển vào thư mục backend: `cd backend`
2. Cài đặt thư viện: `npm install`
3. Cấu hình môi trường trong file `.env` (Database, JWT Secret...)
4. Chạy server ở chế độ phát triển: `npm run dev`
