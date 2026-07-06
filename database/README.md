# Database - Ứng Dụng Đặt Thức Ăn Nhanh

Thư mục này chứa toàn bộ tài nguyên thiết kế cơ sở dữ liệu MySQL của dự án.

## Tài liệu bên trong
*   `db_schema.sql`: File script SQL tạo bảng, ràng buộc khóa chính, khóa ngoại.
*   `seed_data.sql`: Script nạp dữ liệu mẫu ban đầu (danh sách món ăn, danh mục, tài khoản mẫu).
*   `erd_diagram.png`: Sơ đồ quan hệ thực thể (ERD) hiển thị cấu trúc liên kết giữa các bảng.

## Phân công thực hiện
*   **Người phụ trách:** Đỗ Thị Mai Hương
*   **Nhánh Git:** `database`

## Cách khôi phục cơ sở dữ liệu
1. Đăng nhập vào MySQL Server của bạn (MySQL Workbench hoặc CLI).
2. Tạo database mới: `CREATE DATABASE fastfood_db;`
3. Chạy file `db_schema.sql` để tạo cấu trúc bảng.
4. Chạy file `seed_data.sql` để nạp dữ liệu mẫu.
