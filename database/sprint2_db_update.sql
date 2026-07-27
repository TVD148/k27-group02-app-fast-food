-- ============================================================================
-- DỰ ÁN: ỨNG DỤNG ĐẶT THỨC ĂN NHANH (FAST FOOD APP)
-- FILE: sprint2_db_update.sql (CẬP NHẬT CẤU TRÚC DATABASE SPRINT 2)
-- NGƯỜI THỰC HIỆN: ĐỖ THỊ MAI HƯƠNG (DATABASE ARCHITECT) & KỸ SƯ DEVOPS
-- ============================================================================

USE `fastfood_db`;

-- Tạm thời tắt kiểm tra khóa ngoại để thực hiện cập nhật và drop bảng cũ (nếu có)
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. CẬP NHẬT BẢNG CỦ: BỔ SUNG CỘT QUẢN LÝ TỒN KHO MÓN ĂN (INVENTORY)
-- ============================================================================
-- Thêm cột so_luong_ton vào bảng mon_an để kiểm soát số lượng nguyên liệu/món sẵn có trong ngày
ALTER TABLE `mon_an` 
ADD COLUMN `so_luong_ton` INT NOT NULL DEFAULT 100 CHECK (`so_luong_ton` >= 0);

-- Dọn dẹp các bảng thuộc Sprint 2 nếu đã tồn tại từ trước
DROP TABLE IF EXISTS `lich_su_trang_thai_don`;
DROP TABLE IF EXISTS `chi_tiet_don_hang`;
DROP TABLE IF EXISTS `don_hang`;
DROP TABLE IF EXISTS `chi_tiet_gio_hang`;
DROP TABLE IF EXISTS `gio_hang`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 2. BẢNG: gio_hang (Quản lý giỏ hàng của từng khách hàng)
-- ============================================================================
CREATE TABLE `gio_hang` (
  `ma_gio_hang` INT(11) NOT NULL AUTO_INCREMENT,
  `ma_nguoi_dung` INT(11) NOT NULL,
  `ngay_tao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ma_gio_hang`),
  UNIQUE KEY `uk_gio_hang_nguoidung` (`ma_nguoi_dung`),
  CONSTRAINT `fk_giohang_nguoidung` FOREIGN KEY (`ma_nguoi_dung`) REFERENCES `nguoi_dung` (`ma_nguoi_dung`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. BẢNG: chi_tiet_gio_hang (Các món ăn & tùy chọn đã chọn trong giỏ hàng)
-- ============================================================================
CREATE TABLE `chi_tiet_gio_hang` (
  `ma_chi_tiet_gio` INT(11) NOT NULL AUTO_INCREMENT,
  `ma_gio_hang` INT(11) NOT NULL,
  `ma_mon_an` INT(11) NOT NULL,
  `so_luong` INT(11) NOT NULL DEFAULT 1 CHECK (`so_luong` > 0),
  `tuy_chon_da_chon` JSON DEFAULT NULL COMMENT 'Mảng mã giá trị tùy chọn (Size, Topping) dưới dạng JSON',
  `gia_tam_tinh` DECIMAL(10,0) NOT NULL DEFAULT 0 CHECK (`gia_tam_tinh` >= 0),
  `ngay_tao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ma_chi_tiet_gio`),
  CONSTRAINT `fk_ctgh_giohang` FOREIGN KEY (`ma_gio_hang`) REFERENCES `gio_hang` (`ma_gio_hang`) ON DELETE CASCADE,
  CONSTRAINT `fk_ctgh_monan` FOREIGN KEY (`ma_mon_an`) REFERENCES `mon_an` (`ma_mon_an`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. BẢNG: don_hang (Thông tin đơn đặt hàng từ khách hàng)
-- ============================================================================
CREATE TABLE `don_hang` (
  `ma_don_hang` INT(11) NOT NULL AUTO_INCREMENT,
  `ma_nguoi_dung` INT(11) NOT NULL,
  `ma_shipper` INT(11) DEFAULT NULL,
  `tong_tien_hang` DECIMAL(10,0) NOT NULL CHECK (`tong_tien_hang` >= 0),
  `phi_giao_hang` DECIMAL(10,0) NOT NULL DEFAULT 15000 CHECK (`phi_giao_hang` >= 0),
  `tong_thanh_toan` DECIMAL(10,0) NOT NULL CHECK (`tong_thanh_toan` >= 0),
  `dia_chi_giao_hang` TEXT NOT NULL,
  `so_dien_thoai_nhan` VARCHAR(20) NOT NULL,
  `ghi_chu` TEXT DEFAULT NULL,
  `phuong_thuc_thanh_toan` ENUM('tien_mat', 'chuyen_khoan', 'momo', 'vnpay') NOT NULL DEFAULT 'tien_mat',
  `trang_thai_thanh_toan` ENUM('chua_thanh_toan', 'da_thanh_toan', 'hoan_tien') NOT NULL DEFAULT 'chua_thanh_toan',
  `trang_thai_don_hang` ENUM('cho_xac_nhan', 'dang_che_bien', 'dang_giao', 'da_giao', 'da_huy') NOT NULL DEFAULT 'cho_xac_nhan',
  `ngay_dat` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ma_don_hang`),
  CONSTRAINT `fk_donhang_khachhang` FOREIGN KEY (`ma_nguoi_dung`) REFERENCES `nguoi_dung` (`ma_nguoi_dung`) ON DELETE RESTRICT,
  CONSTRAINT `fk_donhang_shipper` FOREIGN KEY (`ma_shipper`) REFERENCES `nguoi_dung` (`ma_nguoi_dung`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. BẢNG: chi_tiet_don_hang (Chi tiết từng món ăn trong đơn hàng)
-- ============================================================================
CREATE TABLE `chi_tiet_don_hang` (
  `ma_chi_tiet_don` INT(11) NOT NULL AUTO_INCREMENT,
  `ma_don_hang` INT(11) NOT NULL,
  `ma_mon_an` INT(11) NOT NULL,
  `ten_mon_an` VARCHAR(255) NOT NULL,
  `don_gia` DECIMAL(10,0) NOT NULL CHECK (`don_gia` >= 0),
  `so_luong` INT(11) NOT NULL CHECK (`so_luong` > 0),
  `tuy_chon_da_chon` JSON DEFAULT NULL COMMENT 'Mảng lưu tên và giá các tùy chọn tại thời điểm đặt',
  `thanh_tien` DECIMAL(10,0) NOT NULL CHECK (`thanh_tien` >= 0),
  PRIMARY KEY (`ma_chi_tiet_don`),
  CONSTRAINT `fk_ctdh_donhang` FOREIGN KEY (`ma_don_hang`) REFERENCES `don_hang` (`ma_don_hang`) ON DELETE CASCADE,
  CONSTRAINT `fk_ctdh_monan` FOREIGN KEY (`ma_mon_an`) REFERENCES `mon_an` (`ma_mon_an`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. BẢNG: lich_su_trang_thai_don (Theo dõi tiến trình & lịch sử trạng thái đơn)
-- ============================================================================
CREATE TABLE `lich_su_trang_thai_don` (
  `ma_lich_su` INT(11) NOT NULL AUTO_INCREMENT,
  `ma_don_hang` INT(11) NOT NULL,
  `trang_thai_cu` VARCHAR(50) DEFAULT NULL,
  `trang_thai_moi` VARCHAR(50) NOT NULL,
  `ghi_chu` TEXT DEFAULT NULL,
  `nguoi_thuc_hien` VARCHAR(255) DEFAULT NULL COMMENT 'Người đổi trạng thái (Khách hàng, Nhân viên bếp, Shipper, Hệ thống)',
  `ngay_tao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ma_lich_su`),
  CONSTRAINT `fk_ls_donhang` FOREIGN KEY (`ma_don_hang`) REFERENCES `don_hang` (`ma_don_hang`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CẤU HÌNH INDEXES (TỐI ƯU HÓA TRUY VẤN SPRINT 2)
-- ============================================================================
CREATE INDEX `idx_donhang_khachhang` ON `don_hang` (`ma_nguoi_dung`);
CREATE INDEX `idx_donhang_shipper` ON `don_hang` (`ma_shipper`);
CREATE INDEX `idx_donhang_trangthai` ON `don_hang` (`trang_thai_don_hang`);
CREATE INDEX `idx_donhang_ngaydat` ON `don_hang` (`ngay_dat`);
CREATE INDEX `idx_ctgh_giohang` ON `chi_tiet_gio_hang` (`ma_gio_hang`);
CREATE INDEX `idx_ctdh_donhang` ON `chi_tiet_don_hang` (`ma_don_hang`);
