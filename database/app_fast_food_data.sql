-- ============================================================================
-- DỰ ÁN: ỨNG DỤNG ĐẶT THỨC ĂN NHANH (FAST FOOD APP)
-- FILE: app_fast_food_data.sql (NẠP DỮ LIỆU MẪU)
-- NGƯỜI THỰC HIỆN: ĐỖ THỊ MAI HƯƠNG (DATABASE) & TRẦN VĂN ĐÌNH (BACKEND)
-- ============================================================================

USE `fastfood_db`;

-- Tạm thời tắt kiểm tra khóa ngoại để tránh lỗi phụ thuộc dữ liệu khi chèn
SET FOREIGN_KEY_CHECKS = 0;

-- Xóa dữ liệu cũ của các bảng này trước khi nạp
DELETE FROM `tuy_chon_mon_an`;
DELETE FROM `gia_tri_tuy_chon`;
DELETE FROM `nhom_tuy_chon`;
DELETE FROM `mon_an`;
DELETE FROM `danh_muc`;
DELETE FROM `nguoi_dung`;
DELETE FROM `vai_tro`;

ALTER TABLE `gia_tri_tuy_chon` AUTO_INCREMENT = 1;
ALTER TABLE `nhom_tuy_chon` AUTO_INCREMENT = 1;
ALTER TABLE `mon_an` AUTO_INCREMENT = 1;
ALTER TABLE `danh_muc` AUTO_INCREMENT = 1;
ALTER TABLE `nguoi_dung` AUTO_INCREMENT = 1;
ALTER TABLE `vai_tro` AUTO_INCREMENT = 1;

-- ============================================================================
-- 1. NẠP DỮ LIỆU: vai_tro
-- ============================================================================
INSERT INTO `vai_tro` (`ma_vai_tro`, `ten_vai_tro`, `mo_ta`) VALUES
(1, 'khach_hang', 'Khách hàng đặt món qua ứng dụng di động'),
(2, 'nhan_vien', 'Nhân viên quản lý cửa hàng và kho bếp'),
(3, 'quan_tri', 'Quản trị viên toàn quyền hệ thống'),
(4, 'shipper', 'Tài xế giao hàng công nghệ của hệ thống');

-- ============================================================================
-- 2. NẠP DỮ LIỆU: nguoi_dung (Mật khẩu mặc định băm bằng bcrypt là '123456')
-- ============================================================================
INSERT INTO `nguoi_dung` (`ma_nguoi_dung`, `ho_ten`, `email`, `mat_khau`, `so_dien_thoai`, `dia_chi`, `ma_vai_tro`, `trang_thai`) VALUES
(1, 'Trần Văn Đình', 'dinh@fastfood.com', '$2a$10$tZ2Z05pC2UepjW1vM/5KqucK42n.J9lJ5eFv.Y4tQx3j38zK4aDGu', '0912345678', 'Bình Dương', 3, 'hoat_dong'), -- Admin/BE
(2, 'Trịnh Nhật Hoàng', 'hoang@fastfood.com', '$2a$10$tZ2Z05pC2UepjW1vM/5KqucK42n.J9lJ5eFv.Y4tQx3j38zK4aDGu', '0923456789', 'Hồ Chí Minh', 1, 'hoat_dong'), -- Khách hàng/FE
(3, 'Đỗ Thị Mai Hương', 'huong@fastfood.com', '$2a$10$tZ2Z05pC2UepjW1vM/5KqucK42n.J9lJ5eFv.Y4tQx3j38zK4aDGu', '0934567890', 'Đồng Nai', 2, 'hoat_dong'), -- Nhân viên/DB
(4, 'Nguyễn Văn Shipper', 'shipper@fastfood.com', '$2a$10$tZ2Z05pC2UepjW1vM/5KqucK42n.J9lJ5eFv.Y4tQx3j38zK4aDGu', '0945678901', 'Bình Dương', 4, 'hoat_dong'); -- Shipper

-- ============================================================================
-- 3. NẠP DỮ LIỆU: danh_muc
-- ============================================================================
INSERT INTO `danh_muc` (`ma_danh_muc`, `ten_danh_muc`, `mo_ta`, `hinh_anh`) VALUES
(1, 'Burgers', 'Các loại bánh mì kẹp thịt bò nướng, gà rán nóng hổi', 'burger_category.png'),
(2, 'Gà Rán', 'Gà rán giòn rụm cay cay tẩm gia vị truyền thống', 'chicken_category.png'),
(3, 'Đồ Uống', 'Nước giải khát và trà đào tươi mát', 'drinks_category.png'),
(4, 'Combo Tiết Kiệm', 'Bữa ăn combo tiện lợi kết hợp đầy đủ với giá ưu đãi', 'combo_category.png');

-- ============================================================================
-- 4. NẠP DỮ LIỆU: mon_an
-- ============================================================================
INSERT INTO `mon_an` (`ma_mon_an`, `ten_mon`, `mo_ta`, `gia_ban`, `hinh_anh`, `ma_danh_muc`, `trang_thai`) VALUES
(1, 'Burger Bò Cực Hạn', 'Nhân 2 lớp thịt bò Úc nướng thơm lừng, phô mai Cheddar béo ngậy', 69000, 'burger_bo.png', 1, 'con_hang'),
(2, 'Burger Gà Giòn Sốt Mayo', 'Bánh mì kẹp phi-lê gà rán giòn rụm kết hợp sốt mayonnaise béo', 49000, 'burger_ga.png', 1, 'con_hang'),
(3, 'Gà Rán Giòn Rụm (1 Miếng)', '1 miếng gà rán giòn rụm bên ngoài, mọng nước bên trong', 35000, 'ga_ran_1.png', 2, 'con_hang'),
(4, 'Khoai Tây Chiên Cỡ Vừa', 'Khoai tây cắt lát chiên vàng giòn, chấm kèm tương cà', 25000, 'fries.png', 2, 'con_hang'),
(5, 'Pepsi Không Calo (Lon)', 'Nước ngọt Pepsi vị chanh thanh mát, không chứa calo', 15000, 'pepsi.png', 3, 'con_hang'),
(6, 'Trà Đào Sả Đá', 'Trà đào mát lạnh kết hợp miếng đào tươi giòn và hương sả', 29000, 'tra_dao.png', 3, 'con_hang'),
(7, 'Combo Gà Giòn Độc Hành', 'Gồm 1 Gà rán + 1 Khoai tây chiên nhỏ + 1 Pepsi lon', 65000, 'combo_don.png', 4, 'con_hang'),
(8, 'Combo Đôi Lứa No Nê', 'Gồm 2 Burger gà giòn + 1 Gà rán + 1 Khoai tây vừa + 2 Pepsi lon', 139000, 'combo_doi.png', 4, 'con_hang');

-- ============================================================================
-- 5. NẠP DỮ LIỆU: nhom_tuy_chon
-- ============================================================================
INSERT INTO `nhom_tuy_chon` (`ma_nhom`, `ten_nhom`, `la_bat_buoc`, `chon_toi_da`) VALUES
(1, 'Kích cỡ nước ngọt (Size)', 1, 1),
(2, 'Thêm Topping cho Burger', 0, 3),
(3, 'Tùy chọn vị Gà rán', 1, 1);

-- ============================================================================
-- 6. NẠP DỮ LIỆU: gia_tri_tuy_chon
-- ============================================================================
INSERT INTO `gia_tri_tuy_chon` (`ma_gia_tri`, `ma_nhom`, `ten_gia_tri`, `gia_tang_them`) VALUES
(1, 1, 'Cỡ Nhỏ (S)', 0),
(2, 1, 'Cỡ Vừa (M)', 5000),
(3, 1, 'Cỡ Lớn (L)', 9000),
(4, 2, 'Thêm Phô Mai lát Cheddar', 8000),
(5, 2, 'Thêm Thịt xông khói Bacon', 15000),
(6, 2, 'Thêm Trứng ốp la', 7000),
(7, 3, 'Vị Truyền thống (Không cay)', 0),
(8, 3, 'Vị Sốt Cay Hàn Quốc', 5000),
(9, 3, 'Vị Sốt Phô mai tỏi', 6000);

-- ============================================================================
-- 7. NẠP DỮ LIỆU: tuy_chon_mon_an
-- ============================================================================
INSERT INTO `tuy_chon_mon_an` (`ma_mon_an`, `ma_nhom`) VALUES
(1, 2), -- Burger Bò Cực Hạn có chọn topping
(2, 2), -- Burger Gà Giòn có chọn topping
(3, 3), -- Gà Rán Giòn Rụm có chọn vị
(5, 1), -- Pepsi có chọn size
(6, 1), -- Trà đào có chọn size
(7, 1), -- Combo có chọn size nước
(7, 3), -- Combo có chọn vị gà
(8, 1), -- Combo đôi có chọn size nước
(8, 3); -- Combo đôi có chọn vị gà

SET FOREIGN_KEY_CHECKS = 1;
