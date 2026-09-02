-- ============================================================================
-- DỰ ÁN: ỨNG DỤNG ĐẶT THỨC ĂN NHANH (FAST FOOD APP)
-- FILE: sprint3_db_update.sql (CẬP NHẬT CẤU TRÚC DATABASE SPRINT 3)
<<<<<<< HEAD
-- TÍNH NĂNG TRỌNG TÂM: TÙY BIẾN DINH DƯỠNG (KILLER FEATURE) & THANH TOÁN TRỰC TIẾP
-- NGƯỜI THỰC HIỆN: CHUYÊN GIA DATABASE (MYSQL) & KỸ SƯ DEVOPS
=======
-- NGƯỜI THỰC HIỆN: ĐỖ THỊ MAI HƯƠNG (DATABASE ARCHITECT) & KỸ SƯ DEVOPS
>>>>>>> origin/database
-- ============================================================================

USE `fastfood_db`;

<<<<<<< HEAD
-- Tạm thời tắt kiểm tra khóa ngoại để thực hiện dọn dẹp và khởi tạo an toàn
SET FOREIGN_KEY_CHECKS = 0;

-- Dọn dẹp các bảng thuộc Sprint 3 nếu đã tồn tại từ trước
DROP TABLE IF EXISTS `thanh_toan`;
DROP TABLE IF EXISTS `mon_an_nguyen_lieu`;
=======
-- Tạm thời tắt kiểm tra khóa ngoại để thực hiện cập nhật và drop bảng cũ (nếu có)
SET FOREIGN_KEY_CHECKS = 0;

-- Dọn dẹp các bảng thuộc Sprint 3 nếu đã tồn tại từ trước
DROP TABLE IF EXISTS `nhat_ky_thanh_toan`;
DROP TABLE IF EXISTS `cong_thuc_mon_an`;
>>>>>>> origin/database
DROP TABLE IF EXISTS `nguyen_lieu`;
DROP TABLE IF EXISTS `ma_giam_gia`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
<<<<<<< HEAD
-- 1. BẢNG: nguyen_lieu (Quản lý nguyên liệu & Thông tin dinh dưỡng Calo, Protein, Carbs, Fat)
-- ============================================================================
CREATE TABLE `nguyen_lieu` (
  `ma_nguyen_lieu` INT(11) NOT NULL AUTO_INCREMENT,
  `ten_nguyen_lieu` VARCHAR(100) NOT NULL COMMENT 'Tên nguyên liệu (Thịt bò Mỹ, Phô mai Cheddar, Xà lách...)',
  `don_vi_tinh` VARCHAR(20) NOT NULL DEFAULT 'gram' COMMENT 'Đơn vị tính: gram, ml, lát, miếng',
  `calo` DECIMAL(8,2) NOT NULL DEFAULT 0.00 COMMENT 'Năng lượng (kcal)',
  `protein` DECIMAL(8,2) NOT NULL DEFAULT 0.00 COMMENT 'Hàm lượng Đạm / Protein (g)',
  `carbs` DECIMAL(8,2) NOT NULL DEFAULT 0.00 COMMENT 'Hàm lượng Tinh bột / Carbohydrates (g)',
  `fat` DECIMAL(8,2) NOT NULL DEFAULT 0.00 COMMENT 'Hàm lượng Chất béo / Fat (g)',
  `don_gia_thay_doi` DECIMAL(10,0) NOT NULL DEFAULT 0 COMMENT 'Phụ thu khi khách chọn thêm nguyên liệu (VNĐ)',
  `trang_thai` ENUM('co_san', 'het_hang') NOT NULL DEFAULT 'co_san',
  `ngay_tao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ma_nguyen_lieu`),
  KEY `idx_nguyenlieu_trangthai` (`trang_thai`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu trữ thông tin nguyên liệu và chỉ số dinh dưỡng';

-- ============================================================================
-- 2. BẢNG: mon_an_nguyen_lieu (Công thức nguyên liệu mặc định & Quy định tùy biến cho món ăn)
-- ============================================================================
CREATE TABLE `mon_an_nguyen_lieu` (
  `ma_mon_an_nguyen_lieu` INT(11) NOT NULL AUTO_INCREMENT,
  `ma_mon_an` INT(11) NOT NULL,
  `ma_nguyen_lieu` INT(11) NOT NULL,
  `so_luong_mac_dinh` DECIMAL(8,2) NOT NULL DEFAULT 1.00 COMMENT 'Số lượng chuẩn trong 1 khẩu phần mặc định',
  `co_the_tuy_bien` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1: Được phép tăng/giảm/bỏ, 0: Cố định',
  `so_luong_toi_da` DECIMAL(8,2) NOT NULL DEFAULT 3.00 COMMENT 'Số lượng tối đa khách được phép tăng thêm',
  `ngay_tao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ma_mon_an_nguyen_lieu`),
  UNIQUE KEY `uk_monan_nguyenlieu` (`ma_mon_an`, `ma_nguyen_lieu`),
  CONSTRAINT `fk_manl_monan` FOREIGN KEY (`ma_mon_an`) REFERENCES `mon_an` (`ma_mon_an`) ON DELETE CASCADE,
  CONSTRAINT `fk_manl_nguyenlieu` FOREIGN KEY (`ma_nguyen_lieu`) REFERENCES `nguyen_lieu` (`ma_nguyen_lieu`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng trung gian định lượng nguyên liệu cho từng món ăn';

-- ============================================================================
-- 3. BẢNG: ma_giam_gia (Quản lý mã khuyến mãi & Voucher giảm giá)
-- ============================================================================
CREATE TABLE `ma_giam_gia` (
  `ma_voucher` INT(11) NOT NULL AUTO_INCREMENT,
  `ma_code` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã voucher khách nhập (VD: FAST30, HELLO2026)',
  `ten_voucher` VARCHAR(255) NOT NULL COMMENT 'Tên chương trình khuyến mãi',
  `mo_ta` TEXT DEFAULT NULL,
  `loai_giam_gia` ENUM('phan_tram', 'so_tien') NOT NULL DEFAULT 'phan_tram' COMMENT 'Giảm theo % hoặc Số tiền cố định',
  `gia_tri_giam` DECIMAL(10,2) NOT NULL COMMENT 'Tỷ lệ % (vd: 30) hoặc số tiền (vd: 30000)',
  `giam_toi_da` DECIMAL(10,0) DEFAULT NULL COMMENT 'Số tiền giảm tối đa với loại giảm phần trăm (VNĐ)',
  `don_hang_toi_thieu` DECIMAL(10,0) NOT NULL DEFAULT 0 COMMENT 'Giá trị đơn hàng tối thiểu được áp dụng (VNĐ)',
  `so_luong_phat_hanh` INT(11) NOT NULL DEFAULT 100 COMMENT 'Tổng số lượt phát hành',
  `so_luong_da_dung` INT(11) NOT NULL DEFAULT 0 COMMENT 'Số lượt đã sử dụng',
  `ngay_bat_dau` DATETIME NOT NULL,
  `ngay_ket_thuc` DATETIME NOT NULL,
  `trang_thai` ENUM('hoat_dong', 'het_han', 'tam_dung') NOT NULL DEFAULT 'hoat_dong',
  `ngay_tao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ma_voucher`),
  KEY `idx_magiamgia_code` (`ma_code`),
  KEY `idx_magiamgia_trangthai` (`trang_thai`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng quản lý mã giảm giá và chương trình ưu đãi';

-- ============================================================================
-- 4. BẢNG: thanh_toan (Nhật ký giao dịch trực tuyến VietQR, MoMo, VNPAY, COD)
-- ============================================================================
CREATE TABLE `thanh_toan` (
  `ma_thanh_toan` INT(11) NOT NULL AUTO_INCREMENT,
  `ma_don_hang` INT(11) NOT NULL,
  `phuong_thuc` ENUM('vietqr', 'momo', 'vnpay', 'tien_mat') NOT NULL DEFAULT 'vietqr',
  `ma_giao_dich_cong` VARCHAR(100) DEFAULT NULL COMMENT 'Mã giao dịch trả về từ ngân hàng / cổng thanh toán',
  `so_tien` DECIMAL(10,0) NOT NULL CHECK (`so_tien` >= 0),
  `trang_thai_thanh_toan` ENUM('cho_thanh_toan', 'thanh_cong', 'that_bai', 'da_hoan_tien') NOT NULL DEFAULT 'cho_thanh_toan',
  `noi_dung_chuyen_khoan` VARCHAR(255) DEFAULT NULL COMMENT 'Nội dung chuyển khoản (VD: FASTFOOD10025)',
  `ma_qr_code_url` TEXT DEFAULT NULL COMMENT 'Đường dẫn / Chuỗi QR Code VietQR sinh ra',
  `ngay_thanh_toan` DATETIME DEFAULT NULL,
  `ngay_tao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ma_thanh_toan`),
  KEY `idx_thanhtoan_donhang` (`ma_don_hang`),
  KEY `idx_thanhtoan_trangthai` (`trang_thai_thanh_toan`),
  CONSTRAINT `fk_thanhtoan_donhang` FOREIGN KEY (`ma_don_hang`) REFERENCES `don_hang` (`ma_don_hang`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng nhật ký giao dịch và cổng thanh toán trực tuyến';

-- ============================================================================
-- 5. CẬP NHẬT BẢNG CỦ: BỔ SUNG VOUCHER & DINH DƯỠNG TÙY BIẾN
-- ============================================================================
-- 5.1 Thêm thông tin voucher và số tiền giảm vào bảng don_hang
ALTER TABLE `don_hang` 
ADD COLUMN `ma_voucher` INT(11) DEFAULT NULL AFTER `ma_shipper`,
ADD COLUMN `so_tien_giam` DECIMAL(10,0) NOT NULL DEFAULT 0 AFTER `phi_giao_hang`,
ADD CONSTRAINT `fk_donhang_voucher` FOREIGN KEY (`ma_voucher`) REFERENCES `ma_giam_gia` (`ma_voucher`) ON DELETE SET NULL;

-- 5.2 Thêm cột dinh_duong_tuy_bien (JSON) vào bảng chi_tiet_gio_hang
ALTER TABLE `chi_tiet_gio_hang`
ADD COLUMN `dinh_duong_tuy_bien` JSON DEFAULT NULL COMMENT 'Lưu danh sách điều chỉnh nguyên liệu [{ma_nguyen_lieu: 1, so_luong: 2}]';

-- 5.3 Thêm cột dinh_duong_tuy_bien (JSON) vào bảng chi_tiet_don_hang
ALTER TABLE `chi_tiet_don_hang`
ADD COLUMN `dinh_duong_tuy_bien` JSON DEFAULT NULL COMMENT 'Lưu snapshot dinh dưỡng tùy biến (Calo, Protein, Carbs, Fat) tại thời điểm đặt';
=======
-- 1. BẢNG: nguyen_lieu (Quản lý thông tin nguyên liệu và hàm lượng dinh dưỡng)
-- ============================================================================
CREATE TABLE `nguyen_lieu` (
  `ma_nguyen_lieu` INT(11) NOT NULL AUTO_INCREMENT,
  `ten_nguyen_lieu` VARCHAR(255) NOT NULL,
  `calo` DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (`calo` >= 0),
  `protein` DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (`protein` >= 0),
  `carbs` DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (`carbs` >= 0),
  `fat` DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (`fat` >= 0),
  `don_vi_tinh` VARCHAR(50) NOT NULL,
  `ngay_tao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ma_nguyen_lieu`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. BẢNG: cong_thuc_mon_an (Liên kết định lượng nguyên liệu mặc định của món ăn)
-- ============================================================================
CREATE TABLE `cong_thuc_mon_an` (
  `ma_cong_thuc` INT(11) NOT NULL AUTO_INCREMENT,
  `ma_mon_an` INT(11) NOT NULL,
  `ma_nguyen_lieu` INT(11) NOT NULL,
  `dinh_luong_mac_dinh` DECIMAL(10,2) NOT NULL CHECK (`dinh_luong_mac_dinh` > 0),
  PRIMARY KEY (`ma_cong_thuc`),
  UNIQUE KEY `uk_congthuc_monan_nguyenlieu` (`ma_mon_an`, `ma_nguyen_lieu`),
  CONSTRAINT `fk_congthuc_monan` FOREIGN KEY (`ma_mon_an`) REFERENCES `mon_an` (`ma_mon_an`) ON DELETE CASCADE,
  CONSTRAINT `fk_congthuc_nguyenlieu` FOREIGN KEY (`ma_nguyen_lieu`) REFERENCES `nguyen_lieu` (`ma_nguyen_lieu`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. BẢNG: ma_giam_gia (Quản lý các chương trình khuyến mãi/Voucher)
-- ============================================================================
CREATE TABLE `ma_giam_gia` (
  `ma_voucher` INT(11) NOT NULL AUTO_INCREMENT,
  `code_voucher` VARCHAR(50) NOT NULL,
  `mo_ta` TEXT DEFAULT NULL,
  `loai_giam_gia` ENUM('phan_tram', 'so_tien') NOT NULL,
  `gia_tri_giam` DECIMAL(10,2) NOT NULL CHECK (`gia_tri_giam` >= 0),
  `gia_tri_don_toi_thieu` DECIMAL(10,0) NOT NULL DEFAULT 0 CHECK (`gia_tri_don_toi_thieu` >= 0),
  `giam_toi_da` DECIMAL(10,0) DEFAULT NULL CHECK (`giam_toi_da` IS NULL OR `giam_toi_da` >= 0),
  `so_luong_luot_dung` INT(11) NOT NULL DEFAULT 0 CHECK (`so_luong_luot_dung` >= 0),
  `ngay_bat_dau` DATETIME NOT NULL,
  `ngay_ket_thuc` DATETIME NOT NULL,
  `trang_thai` ENUM('hoat_dong', 'ngung_hoat_dong') NOT NULL DEFAULT 'hoat_dong',
  PRIMARY KEY (`ma_voucher`),
  UNIQUE KEY `uk_code_voucher` (`code_voucher`),
  CONSTRAINT `chk_ngay_voucher` CHECK (`ngay_ket_thuc` >= `ngay_bat_dau`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. BẢNG: nhat_ky_thanh_toan (Nhật ký giao dịch qua các cổng thanh toán)
-- ============================================================================
CREATE TABLE `nhat_ky_thanh_toan` (
  `ma_giao_dich` INT(11) NOT NULL AUTO_INCREMENT,
  `ma_don_hang` INT(11) NOT NULL,
  `cong_thanh_toan` ENUM('momo', 'vnpay', 'zalopay', 'ngan_hang') NOT NULL,
  `ma_giao_dich_cong` VARCHAR(255) DEFAULT NULL,
  `so_tien` DECIMAL(10,0) NOT NULL CHECK (`so_tien` >= 0),
  `trang_thai_giao_dich` ENUM('cho_xu_ly', 'thanh_cong', 'that_bai', 'hoan_tien') NOT NULL DEFAULT 'cho_xu_ly',
  `noi_dung_phan_hoi` JSON DEFAULT NULL,
  `thoi_gian_tao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ma_giao_dich`),
  CONSTRAINT `fk_nhatky_donhang` FOREIGN KEY (`ma_don_hang`) REFERENCES `don_hang` (`ma_don_hang`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CẤU HÌNH INDEXES (TỐI ƯU HÓA TRUY VẤN SPRINT 3)
-- ============================================================================
CREATE INDEX `idx_nguyenlieu_ten` ON `nguyen_lieu` (`ten_nguyen_lieu`);
CREATE INDEX `idx_congthuc_monan` ON `cong_thuc_mon_an` (`ma_mon_an`);
CREATE INDEX `idx_congthuc_nguyenlieu` ON `cong_thuc_mon_an` (`ma_nguyen_lieu`);
CREATE INDEX `idx_magiamgia_trangthai` ON `ma_giam_gia` (`trang_thai`);
CREATE INDEX `idx_magiamgia_hieuluc` ON `ma_giam_gia` (`ngay_bat_dau`, `ngay_ket_thuc`);
CREATE INDEX `idx_nhatky_donhang` ON `nhat_ky_thanh_toan` (`ma_don_hang`);
CREATE INDEX `idx_nhatky_trangthai` ON `nhat_ky_thanh_toan` (`trang_thai_giao_dich`);
>>>>>>> origin/database
