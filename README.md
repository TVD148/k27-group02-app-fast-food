# Ứng Dụng Đặt Thức Ăn Nhanh (Fast Food App)
## Dự án môn học Lập trình Thiết bị di động - Nhóm K27 Group 02

### 1. Thành viên nhóm & Phân vai
*   **Trần Văn Đình**: Backend Developer (Node.js) & Scrum Master
*   **Trịnh Nhật Hoàng**: Frontend Mobile Developer (React Native / Expo)
*   **Đỗ Thị Mai Hương**: Database Developer (MySQL)

### 2. Cấu trúc Source Code
Dự án được phân rã thành 3 thư mục chính tương ứng với vai trò của từng thành viên:
*   `backend/`: Source code API Node.js/Express, xử lý logic nghiệp vụ và xác thực JWT.
*   `frontend/`: Source code giao diện ứng dụng di động React Native (Expo) dành cho Khách hàng & Cửa hàng.
*   `database/`: Các file thiết kế cơ sở dữ liệu MySQL, sơ đồ ERD, dữ liệu mẫu và các kịch bản SQL.

### 3. Quy ước làm việc trên Git/GitHub
Để tránh xung đột code (conflict), nhóm tuân thủ quy trình phân nhánh nghiêm ngặt:
*   **main**: Nhánh chính chứa phiên bản ổn định nhất của dự án. Không code trực tiếp trên nhánh này.
*   **backend**: Nhánh phát triển của Backend Developer.
*   **frontend**: Nhánh phát triển của Frontend Developer.
*   **database**: Nhánh phát triển của Database Developer.

*Mọi thay đổi đều được kiểm thử trên nhánh riêng trước khi tạo Pull Request (PR) để Merge về nhánh `main`.*
