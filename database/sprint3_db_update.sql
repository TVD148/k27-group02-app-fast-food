-- ============================================================================
-- DỰ ÁN: ỨNG DỤNG ĐẶT THỨC ĂN NHANH (FAST FOOD APP)
-- FILE: sprint3_db_update.sql (CẬP NHẬT CẤU TRÚC DATABASE SPRINT 3)
-- NGƯỜI THỰC HIỆN: ĐỖ THỊ MAI HƯƠNG (DATABASE ARCHITECT) & KỸ SƯ DEVOPS
-- ============================================================================

USE `fastfood_db`;

-- Tạm thời tắt kiểm tra khóa ngoại để thực hiện cập nhật và drop bảng cũ (nếu có)
SET FOREIGN_KEY_CHECKS = 0;

-- Dọn dẹp các bảng thuộc Sprint 3 nếu đã tồn tại từ trước
DROP TABLE IF EXISTS `nhat_ky_thanh_toan`;
DROP TABLE IF EXISTS `cong_thuc_mon_an`;
DROP TABLE IF EXISTS `nguyen_lieu`;
DROP TABLE IF EXISTS `ma_giam_gia`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
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
