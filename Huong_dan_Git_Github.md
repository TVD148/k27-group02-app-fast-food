# TÀI LIỆU HƯỚNG DẪN GIT & QUY TRÌNH LÀM VIỆC HẰNG NGÀY
## Dự án: Ứng Dụng Đặt Thức Ăn Nhanh (Fast Food App)

Tài liệu này hướng dẫn quy trình làm việc chuẩn hằng ngày với Git/GitHub cho 3 thành viên: **Đình (Backend)**, **Hoàng (Frontend)**, **Hương (Database)** và cách xử lý các lỗi Git thường gặp để tránh bị xung đột code (conflict) hoặc mất mát dữ liệu.

---

## PHẦN 1: QUY TRÌNH BẮT ĐẦU NGÀY MỚI (DAILY WORKFLOW)

Để đảm bảo code của mọi thành viên luôn đồng bộ và không bị xung đột, mỗi ngày khi bắt đầu làm việc, các thành viên **bắt buộc** phải tuân thủ quy trình 6 bước dưới đây:

### Bước 1: Cập nhật nhánh `main` mới nhất từ GitHub về máy
Trước khi viết bất kỳ dòng code nào, bạn cần lấy code mới nhất mà các thành viên khác đã merge vào nhánh `main` hôm trước:
```bash
# Chuyển về nhánh main
git checkout main

# Kéo code mới nhất về
git pull origin main
```

### Bước 2: Chuyển sang nhánh cá nhân của mình
*   **Đình (BE):** `git checkout backend`
*   **Hoàng (FE):** `git checkout frontend`
*   **Hương (DB):** `git checkout database`

### Bước 3: Đồng bộ code mới nhất từ `main` vào nhánh cá nhân
Đảm bảo nhánh cá nhân của bạn kế thừa các tính năng mới nhất từ `main` để tránh lỗi xung đột khi merge sau này:
```bash
git merge main
# Hoặc dùng rebase: git rebase main
```
*Lưu ý: Nếu bước này xảy ra conflict (xung đột), hãy xem hướng dẫn xử lý ở Phần 2.*

### Bước 4: Tập trung viết code và hoàn thành task trong ngày
Thực hiện các công việc lập trình, thiết kế cơ sở dữ liệu trên nhánh cá nhân của bạn.

### Bước 5: Lưu lại và đẩy code lên GitHub (Cuối ngày hoặc khi xong tính năng)
Sau khi code chạy thử nghiệm ổn định trên local:
```bash
# Kiểm tra xem có những file nào thay đổi
git status

# Thêm các file thay đổi vào khu vực chuẩn bị (Staging Area)
git add . 
# (Hoặc chỉ thêm thư mục của mình: git add backend/ hoặc git add frontend/)

# Ghi nhận thay đổi kèm thông điệp rõ ràng
git commit -m "Prefix: Mô tả ngắn gọn việc đã làm"
# Ví dụ: git commit -m "BE: hoàn thành API đăng nhập JWT"

# Đẩy code lên nhánh riêng trên GitHub
git push origin <tên_nhánh_của_bạn>
# Ví dụ: git push origin backend
```

### Bước 6: Tạo Pull Request (PR) để Merge vào `main`
1. Truy cập vào GitHub của nhóm: `https://github.com/TVD148/k27-group02-app-fast-food`
2. Chọn **Pull requests** -> **New pull request**.
3. Chọn Base: `main` <- Compare: `<tên_nhánh_của_bạn>` (ví dụ: `backend`).
4. Viết mô tả ngắn gọn những gì đã làm và bấm **Create pull request**.
5. Nhóm trưởng/Scrum Master (Đình) sẽ vào rà soát và bấm **Merge pull request** để hoàn tất.

---

## PHẦN 2: CÁC LỖI THƯỜNG GẶP KHI DÙNG GITHUB & CÁCH KHẮC PHỤC

### Lỗi 1: Bị treo hoặc báo lỗi Authentication (`fatal: could not read Username...`) khi push code
*   **Triệu chứng:** Khi chạy `git push`, Git đứng im rất lâu hoặc trả về thông báo lỗi: *Terminal prompts disabled* hoặc *Permission denied*.
*   **Nguyên nhân:** Git cục bộ trên máy chưa kết nối hoặc chưa được cấp quyền truy cập ghi (write permission) vào repository GitHub `TVD148/k27-group02-app-fast-food`.
*   **Cách khắc phục:**
    1.  **Dùng trình duyệt xác thực (Khuyên dùng):** Khi chạy lệnh push lần đầu, một cửa sổ đăng nhập của Git Credential Manager sẽ hiện ra. Chọn **"Sign in with your browser"**, đăng nhập tài khoản GitHub cá nhân và nhấn **"Authorize"**.
    2.  **Sử dụng Personal Access Token (PAT):** Nếu Git yêu cầu nhập mật khẩu trong Terminal (lưu ý: GitHub đã khai tử mật khẩu thông thường từ 2021), hãy truy cập *GitHub -> Settings -> Developer Settings -> Personal Access Tokens* để tạo một Token. Dùng Token này làm mật khẩu khi Git yêu cầu nhập.
    3.  **Kiểm tra phân quyền thành viên:** Yêu cầu chủ tài khoản `TVD148` vào *Settings -> Collaborators* trên Repo đó và thêm tài khoản GitHub của Đình, Hoàng, Hương vào dự án với quyền **Write** hoặc **Admin**, sau đó kiểm tra và chấp nhận lời mời gửi đến email của bạn.

---

### Lỗi 2: Xung đột code (Merge Conflicts)
*   **Triệu chứng:** Khi chạy `git merge main` hoặc khi tạo Pull Request trên GitHub, Git báo lỗi: *CONFLICT (content): Merge conflict in <tên_file>. Automatic merge failed; fix conflicts and then commit the result.*
*   **Nguyên nhân:** Có ít nhất 2 thành viên cùng sửa đổi trên một dòng code của một file và Git không biết chọn dòng nào.
*   **Cách khắc phục:**
    1.  Mở file bị báo lỗi conflict bằng **VS Code**.
    2.  Bạn sẽ thấy các đoạn code bị xung đột nằm giữa các ký hiệu:
        ```text
        <<<<<<< HEAD (Code hiện tại của bạn)
        hienthiMonAnLocal();
        =======
        hienthiMonAnTrenServer();
        >>>>>>> main (Code mới kéo về từ main)
        ```
    3.  Thảo luận với người cùng viết file đó và chọn 1 trong 4 lựa chọn có sẵn trên VS Code:
        *   *Accept Current Change:* Giữ lại code của bạn, bỏ code kéo về.
        *   *Accept Incoming Change:* Giữ code kéo về, bỏ code của bạn.
        *   *Accept Both Changes:* Giữ cả hai.
    4.  Xóa các ký tự đánh dấu (`<<<<<<<`, `=======`, `>>>>>>>`), lưu file.
    5.  Chạy lệnh lưu và commit lại:
        ```bash
        git add <tên_file_bị_conflict>
        git commit -m "Fix: giải quyết conflict file..."
        ```

---

### Lỗi 3: Commit nhầm vào nhánh `main` ở máy cục bộ (Local)
*   **Triệu chứng:** Bạn chuẩn bị code backend nhưng quên chuyển nhánh, kết quả là đã lỡ gõ `git add` và `git commit` trên nhánh `main` ở máy local của mình (nhưng chưa push).
*   **Nguyên nhân:** Quên không kiểm tra nhánh hiện tại (`git branch`).
*   **Cách khắc phục:**
    ```bash
    # Rút lại commit vừa thực hiện nhưng vẫn giữ lại các file code đã sửa
    git reset --soft HEAD~1

    # Chuyển sang nhánh đúng của bạn (ví dụ: backend)
    git checkout backend

    # Tiến hành add và commit lại trên nhánh đúng
    git add .
    git commit -m "BE: mô tả công việc..."
    ```

---

### Lỗi 4: Đẩy nhầm các file rác lớn (như `node_modules`) hoặc thông tin nhạy cảm (như file cấu hình `.env`) lên GitHub
*   **Triệu chứng:** Lỡ chạy `git add .` khi chưa tạo file `.gitignore`, làm cho các thư mục thư viện nặng hàng trăm MB (`node_modules`) bị tải lên GitHub, khiến việc pull/push cực kỳ chậm.
*   **Cách khắc phục:**
    1.  Tạo ngay một file đặt tên là `.gitignore` ở thư mục gốc của dự án với nội dung:
        ```text
        node_modules/
        .env
        dist/
        .expo/
        ```
    2.  Xóa các file đã lỡ đưa lên Git nhưng **không xóa** file vật lý trên ổ đĩa máy tính:
        ```bash
        git rm -r --cached node_modules/
        git rm --cached .env
        ```
    3.  Commit và push lại thay đổi:
        ```bash
        git commit -m "Fix: loại bỏ file rác khỏi Git Tracking"
        git push origin <tên_nhánh>
        ```

---

### Lỗi 5: Bị từ chối Push (`Updates were rejected because the remote contains work...`)
*   **Triệu chứng:** Khi gõ `git push origin backend`, bạn nhận được thông báo lỗi *[rejected] - non-fast-forward*.
*   **Nguyên nhân:** Trên GitHub đang có những commit mới ở nhánh `backend` (do thành viên khác đẩy lên hoặc do bạn sửa trực tiếp trên web GitHub) mà ở máy local của bạn chưa có.
*   **Cách khắc phục:**
    ```bash
    # Kéo code mới trên nhánh đó về máy để gộp trước
    git pull origin backend
    
    # Nếu có conflict thì giải quyết như Lỗi 2.
    # Sau khi gộp xong, tiến hành push lại:
    git push origin backend
    ```
