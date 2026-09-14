# Database - Ứng Dụng Đặt Thức Ăn Nhanh

Thư mục này chứa toàn bộ tài nguyên thiết kế cơ sở dữ liệu MySQL của dự án.

## Tài liệu bên trong
*   `db_schema.sql`: File script SQL tạo bảng, ràng buộc khóa chính, khóa ngoại.
*   `seed_data.sql`: Script nạp dữ liệu mẫu ban đầu (danh sách món ăn, danh mục, tài khoản mẫu).
*   `erd_diagram.png`: Sơ đồ quan hệ thực thể (ERD) hiển thị cấu trúc liên kết giữa các bảng.

## Phân công thực hiện
*   **Người phụ trách:** Đỗ Thị Mai Hương
*   **Nhánh Git:** `database`

## Thứ tự nạp file SQL khi tạo Database mới:
1. `app_fast_food.sql` (Cấu trúc bảng Sprint 1)
2. `app_fast_food_data.sql` (Dữ liệu mẫu Sprint 1)
3. `sprint2_db_update.sql` (Cấu trúc giỏ hàng, đơn hàng Sprint 2)
4. `sprint2_data_update.sql` (Dữ liệu mẫu Sprint 2)
5. `sprint3_db_update.sql` (Cấu trúc định vị GPS, voucher, dinh dưỡng, thanh toán Sprint 3)
6. `sprint3_data_update.sql` (Dữ liệu mẫu Sprint 3)
