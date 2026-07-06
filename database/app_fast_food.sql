-- ============================================================================
-- DỰ ÁN: ỨNG DỤNG ĐẶT THỨC ĂN NHANH (FAST FOOD APP)
-- FILE: app_fast_food.sql (TẠO BẢNG & RÀNG BUỘC)
-- NGƯỜI THỰC HIỆN: ĐỖ THỊ MAI HƯƠNG (DATABASE) & TRẦN VĂN ĐÌNH (BACKEND)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `fastfood_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `fastfood_db`;

-- Tạm thời tắt kiểm tra khóa ngoại để thực hiện drop bảng an toàn
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `tuy_chon_mon_an`;
DROP TABLE IF EXISTS `gia_tri_tuy_chon`;
DROP TABLE IF EXISTS `nhom_tuy_chon`;
DROP TABLE IF EXISTS `mon_an`;
DROP TABLE IF EXISTS `danh_muc`;
DROP TABLE IF EXISTS `nguoi_dung`;
DROP TABLE IF EXISTS `vai_tro`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 1. BẢNG: vai_tro (Quản lý các vai trò trong hệ thống)
-- ============================================================================
CREATE TABLE `vai_tro` (
  `ma_vai_tro` int(11) NOT NULL AUTO_INCREMENT,
  `ten_vai_tro` varchar(50) NOT NULL,
  `mo_ta` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ma_vai_tro`),
  UNIQUE KEY `uk_ten_vai_tro` (`ten_vai_tro`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. BẢNG: nguoi_dung (Thông tin tài khoản: Admin, Nhân viên, Shipper, Khách hàng)
-- ============================================================================
CREATE TABLE `nguoi_dung` (
  `ma_nguoi_dung` int(11) NOT NULL AUTO_INCREMENT,
  `ho_ten` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `mat_khau` varchar(255) NOT NULL,
  `so_dien_thoai` varchar(20) DEFAULT NULL,
  `dia_chi` text DEFAULT NULL,
  `hinh_anh` varchar(255) DEFAULT NULL,
  `ma_vai_tro` int(11) NOT NULL DEFAULT 1,
  `token_quen_mat_khau` varchar(255) DEFAULT NULL,
  `han_token` datetime DEFAULT NULL,
  `ngay_tao` datetime DEFAULT CURRENT_TIMESTAMP,
  `trang_thai` ENUM ('hoat_dong', 'bi_khoa', 'bi_cam') NOT NULL DEFAULT 'hoat_dong',
  `khoa_den_ngay` datetime DEFAULT NULL,
  `bien_so_xe` varchar(50) DEFAULT NULL,
  `trang_thai_shipper` ENUM ('ranh', 'dang_giao', 'nghi_viec') DEFAULT NULL,
  PRIMARY KEY (`ma_nguoi_dung`),
  UNIQUE KEY `uk_email` (`email`),
  UNIQUE KEY `uk_sdt` (`so_dien_thoai`),
  CONSTRAINT `fk_nguoidung_vaitro` FOREIGN KEY (`ma_vai_tro`) REFERENCES `vai_tro` (`ma_vai_tro`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. BẢNG: danh_muc (Danh mục món ăn: Burger, Gà Rán, Combo...)
-- ============================================================================
CREATE TABLE `danh_muc` (
  `ma_danh_muc` int(11) NOT NULL AUTO_INCREMENT,
  `ten_danh_muc` varchar(255) NOT NULL,
  `mo_ta` text DEFAULT NULL,
  `hinh_anh` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ma_danh_muc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. BẢNG: mon_an (Các món ăn chi tiết trong thực đơn)
-- ============================================================================
CREATE TABLE `mon_an` (
  `ma_mon_an` int(11) NOT NULL AUTO_INCREMENT,
  `ten_mon` varchar(255) NOT NULL,
  `mo_ta` text DEFAULT NULL,
  `gia_ban` decimal(10,0) NOT NULL CHECK (`gia_ban` >= 0), -- Đã tối ưu cho tiền tệ Việt Nam (VND)
  `hinh_anh` varchar(255) DEFAULT NULL,
  `ma_danh_muc` int(11) DEFAULT NULL,
  `trang_thai` ENUM ('con_hang', 'het_hang') NOT NULL DEFAULT 'con_hang',
  PRIMARY KEY (`ma_mon_an`),
  CONSTRAINT `fk_monan_danhmuc` FOREIGN KEY (`ma_danh_muc`) REFERENCES `danh_muc` (`ma_danh_muc`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. BẢNG: nhom_tuy_chon (Nhóm tùy chọn món ăn, ví dụ: Chọn Size nước, Thêm Topping)
-- ============================================================================
CREATE TABLE `nhom_tuy_chon` (
  `ma_nhom` int(11) NOT NULL AUTO_INCREMENT,
  `ten_nhom` varchar(255) NOT NULL,
  `la_bat_buoc` tinyint(1) NOT NULL DEFAULT 0,
  `chon_toi_da` int(11) NOT NULL DEFAULT 1 CHECK (`chon_toi_da` >= 1), -- Đã sửa lỗi chính tả
  PRIMARY KEY (`ma_nhom`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. BẢNG: gia_tri_tuy_chon (Giá trị cụ thể của tùy chọn và mức giá cộng thêm)
-- ============================================================================
CREATE TABLE `gia_tri_tuy_chon` (
  `ma_gia_tri` int(11) NOT NULL AUTO_INCREMENT,
  `ma_nhom` int(11) NOT NULL,
  `ten_gia_tri` varchar(255) NOT NULL,
  `gia_tang_them` decimal(10,0) NOT NULL DEFAULT 0 CHECK (`gia_tang_them` >= 0), -- Tối ưu cho tiền tệ Việt Nam (VND)
  PRIMARY KEY (`ma_gia_tri`),
  CONSTRAINT `fk_giatri_nhom` FOREIGN KEY (`ma_nhom`) REFERENCES `nhom_tuy_chon` (`ma_nhom`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. BẢNG: tuy_chon_mon_an (Liên kết giữa món ăn và nhóm tùy chọn áp dụng)
-- ============================================================================
CREATE TABLE `tuy_chon_mon_an` (
  `ma_mon_an` int(11) NOT NULL,
  `ma_nhom` int(11) NOT NULL,
  PRIMARY KEY (`ma_mon_an`, `ma_nhom`),
  CONSTRAINT `fk_tcma_monan` FOREIGN KEY (`ma_mon_an`) REFERENCES `mon_an` (`ma_mon_an`) ON DELETE CASCADE,
  CONSTRAINT `fk_tcma_nhom` FOREIGN KEY (`ma_nhom`) REFERENCES `nhom_tuy_chon` (`ma_nhom`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CẤU HÌNH INDEXES (TỐI ƯU HÓA TRUY VẤN TÌM KIẾM MÓN)
-- ============================================================================
CREATE INDEX `idx_monan_tenmon` ON `mon_an` (`ten_mon`);
CREATE INDEX `idx_danhmuc_tendanhmuc` ON `danh_muc` (`ten_danh_muc`);
CREATE INDEX `idx_nguoidung_ma_vai_tro` ON `nguoi_dung` (`ma_vai_tro`);
CREATE INDEX `idx_giatri_ma_nhom` ON `gia_tri_tuy_chon` (`ma_nhom`);
