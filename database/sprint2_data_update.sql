-- ============================================================================
-- DỰ ÁN: ỨNG DỤNG ĐẶT THỨC ĂN NHANH (FAST FOOD APP)
-- FILE: sprint2_data_update.sql (NẠP DỮ LIỆU MẪU CHO SPRINT 2)
-- NGƯỜI THỰC HIỆN: ĐỖ THỊ MAI HƯƠNG (DATABASE ARCHITECT) & KỸ SƯ DEVOPS
-- ============================================================================

USE `fastfood_db`;

-- Tạm thời tắt kiểm tra khóa ngoại để thực hiện nạp dữ liệu an toàn
SET FOREIGN_KEY_CHECKS = 0;

-- Dọn dẹp dữ liệu cũ của các bảng thuộc Sprint 2 trước khi nạp
DELETE FROM `lich_su_trang_thai_don`;
DELETE FROM `chi_tiet_don_hang`;
DELETE FROM `don_hang`;
DELETE FROM `chi_tiet_gio_hang`;
DELETE FROM `gio_hang`;

ALTER TABLE `lich_su_trang_thai_don` AUTO_INCREMENT = 1;
ALTER TABLE `chi_tiet_don_hang` AUTO_INCREMENT = 1;
ALTER TABLE `don_hang` AUTO_INCREMENT = 1;
ALTER TABLE `chi_tiet_gio_hang` AUTO_INCREMENT = 1;
ALTER TABLE `gio_hang` AUTO_INCREMENT = 1;

-- ============================================================================
-- 1. BỔ SUNG VAI TRÒ MỚI (PHÂN QUYỀN VAI TRÒ DỰ ÁN)
-- ============================================================================
-- Bổ sung vai trò Nhân viên bếp (Không tạo lại hay xóa bảng vai_tro cũ)
INSERT IGNORE INTO `vai_tro` (`ma_vai_tro`, `ten_vai_tro`, `mo_ta`) VALUES
(5, 'nhan_vien_bep', 'Nhân viên bếp chịu trách nhiệm chế biến và cập nhật trạng thái đơn');

-- Bổ sung tài khoản Nhân viên bếp mẫu (Mật khẩu: 123456)
INSERT IGNORE INTO `nguoi_dung` (`ma_nguoi_dung`, `ho_ten`, `email`, `mat_khau`, `so_dien_thoai`, `dia_chi`, `ma_vai_tro`, `trang_thai`) VALUES
(5, 'Lê Văn Bếp', 'bep@fastfood.com', '$2a$10$tZ2Z05pC2UepjW1vM/5KqucK42n.J9lJ5eFv.Y4tQx3j38zK4aDGu', '0955667788', 'Nhà bếp Cửa hàng 1', 5, 'hoat_dong');

-- ============================================================================
-- 2. CẬP NHẬT SỐ LƯỢNG TỒN KHO CHO CÁC MÓN ĂN (INVENTORY MANAGEMENT)
-- ============================================================================
UPDATE `mon_an` SET `so_luong_ton` = 50 WHERE `ma_mon_an` = 1; -- Burger Bò Cực Hạn
UPDATE `mon_an` SET `so_luong_ton` = 80 WHERE `ma_mon_an` = 2; -- Burger Gà Giòn Sốt Mayo
UPDATE `mon_an` SET `so_luong_ton` = 150 WHERE `ma_mon_an` = 3; -- Gà Rán Giòn Rụm
UPDATE `mon_an` SET `so_luong_ton` = 200 WHERE `ma_mon_an` = 4; -- Khoai Tây Chiên
UPDATE `mon_an` SET `so_luong_ton` = 300 WHERE `ma_mon_an` = 5; -- Pepsi Lon
UPDATE `mon_an` SET `so_luong_ton` = 120 WHERE `ma_mon_an` = 6; -- Trà Đào Sả Đá
UPDATE `mon_an` SET `so_luong_ton` = 40 WHERE `ma_mon_an` = 7; -- Combo Độc Hành
UPDATE `mon_an` SET `so_luong_ton` = 30 WHERE `ma_mon_an` = 8; -- Combo Đôi Lứa

-- ============================================================================
-- 3. NẠP DỮ LIỆU MẪU: gio_hang & chi_tiet_gio_hang
-- ============================================================================
-- Giỏ hàng của khách hàng Trịnh Nhật Hoàng (ma_nguoi_dung = 2)
INSERT INTO `gio_hang` (`ma_gio_hang`, `ma_nguoi_dung`) VALUES
(1, 2);

-- Chi tiết các món đang chờ trong giỏ hàng
INSERT INTO `chi_tiet_gio_hang` (`ma_chi_tiet_gio`, `ma_gio_hang`, `ma_mon_an`, `so_luong`, `tuy_chon_da_chon`, `gia_tam_tinh`) VALUES
(1, 1, 1, 1, '[4, 5]', 92000), -- Burger Bò Cực Hạn (69k) + Phô mai (8k) + Bacon (15k) = 92k
(2, 1, 5, 2, '[2]', 40000);   -- 2 x Pepsi Lon Size M (15k + 5k = 20k/lon) = 40k

-- ============================================================================
-- 4. NẠP DỮ LIỆU MẪU: don_hang (ĐƠN ĐẶT HÀNG MẪU)
-- ============================================================================
-- Đơn hàng 1: Đơn hàng đang được giao (Đã qua bước xác nhận & bếp chế biến)
INSERT INTO `don_hang` (
  `ma_don_hang`, `ma_nguoi_dung`, `ma_shipper`, `tong_tien_hang`, `phi_giao_hang`, `tong_thanh_toan`, 
  `dia_chi_giao_hang`, `so_dien_thoai_nhan`, `ghi_chu`, `phuong_thuc_thanh_toan`, `trang_thai_thanh_toan`, `trang_thai_don_hang`
) VALUES (
  1, 2, 4, 111000, 15000, 126000, 
  '123 Nguyễn Thị Minh Khai, Quận 1, TP. Hồ Chí Minh', '0923456789', 'Cho thêm nhiều tương cà và sốt mayo', 
  'tien_mat', 'chua_thanh_toan', 'dang_giao'
);

-- Đơn hàng 2: Đơn hàng đã hoàn thành giao công nghệ
INSERT INTO `don_hang` (
  `ma_don_hang`, `ma_nguoi_dung`, `ma_shipper`, `tong_tien_hang`, `phi_giao_hang`, `tong_thanh_toan`, 
  `dia_chi_giao_hang`, `so_dien_thoai_nhan`, `ghi_chu`, `phuong_thuc_thanh_toan`, `trang_thai_thanh_toan`, `trang_thai_don_hang`
) VALUES (
  2, 2, 4, 139000, 15000, 154000, 
  '123 Nguyễn Thị Minh Khai, Quận 1, TP. Hồ Chí Minh', '0923456789', 'Giao tận tay giùm em', 
  'momo', 'da_thanh_toan', 'da_giao'
);

-- ============================================================================
-- 5. NẠP DỮ LIỆU MẪU: chi_tiet_don_hang
-- ============================================================================
-- Món thuộc Đơn hàng 1
INSERT INTO `chi_tiet_don_hang` (`ma_chi_tiet_don`, `ma_don_hang`, `ma_mon_an`, `ten_mon_an`, `don_gia`, `so_luong`, `tuy_chon_da_chon`, `thanh_tien`) VALUES
(1, 1, 1, 'Burger Bò Cực Hạn', 69000, 1, '[{"ten": "Thêm Phô Mai lát Cheddar", "gia": 8000}]', 77000),
(2, 1, 6, 'Trà Đào Sả Đá', 29000, 1, '[{"ten": "Cỡ Vừa (M)", "gia": 5000}]', 34000);

-- Món thuộc Đơn hàng 2
INSERT INTO `chi_tiet_don_hang` (`ma_chi_tiet_don`, `ma_don_hang`, `ma_mon_an`, `ten_mon_an`, `don_gia`, `so_luong`, `tuy_chon_da_chon`, `thanh_tien`) VALUES
(3, 2, 8, 'Combo Đôi Lứa No Nê', 139000, 1, '[{"ten": "Cỡ Vừa (M)", "gia": 5000}, {"ten": "Vị Truyền thống", "gia": 0}]', 139000);

-- ============================================================================
-- 6. NẠP DỮ LIỆU MẪU: lich_su_trang_thai_don (LỊCH SỬ TIẾN TRÌNH ĐƠN HÀNG)
-- ============================================================================
-- Tiến trình của Đơn hàng 1
INSERT INTO `lich_su_trang_thai_don` (`ma_don_hang`, `trang_thai_cu`, `trang_thai_moi`, `ghi_chu`, `nguoi_thuc_hien`) VALUES
(1, NULL, 'cho_xac_nhan', 'Khách hàng đặt đơn thành công', 'Trịnh Nhật Hoàng'),
(1, 'cho_xac_nhan', 'dang_che_bien', 'Nhà bếp đã nhận đơn và bắt đầu chế biến món ăn', 'Lê Văn Bếp'),
(1, 'dang_che_bien', 'dang_giao', 'Shipper đã nhận hàng và bắt đầu di chuyển giao', 'Nguyễn Văn Shipper');

-- Tiến trình của Đơn hàng 2
INSERT INTO `lich_su_trang_thai_don` (`ma_don_hang`, `trang_thai_cu`, `trang_thai_moi`, `ghi_chu`, `nguoi_thuc_hien`) VALUES
(2, NULL, 'cho_xac_nhan', 'Khách hàng đặt đơn thành công qua MoMo', 'Trịnh Nhật Hoàng'),
(2, 'cho_xac_nhan', 'dang_che_bien', 'Nhà bếp chế biến xong', 'Lê Văn Bếp'),
(2, 'dang_che_bien', 'dang_giao', 'Shipper đang lấy hàng', 'Nguyễn Văn Shipper'),
(2, 'dang_giao', 'da_giao', 'Đã giao hàng thành công và nhận tiền qua MoMo', 'Nguyễn Văn Shipper');

SET FOREIGN_KEY_CHECKS = 1;
