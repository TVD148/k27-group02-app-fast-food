-- ============================================================================
-- DỰ ÁN: ỨNG DỤNG ĐẶT THỨC ĂN NHANH (FAST FOOD APP)
-- FILE: sprint3_data_update.sql (NẠP DỮ LIỆU MẪU CHO SPRINT 3)
-- NGƯỜI THỰC HIỆN: CHUYÊN GIA DATABASE (MYSQL) & KỸ SƯ DEVOPS
-- ============================================================================

USE `fastfood_db`;

-- Tạm thời tắt kiểm tra khóa ngoại để thực hiện nạp dữ liệu an toàn
SET FOREIGN_KEY_CHECKS = 0;

-- Dọn dẹp dữ liệu cũ của các bảng thuộc Sprint 3 trước khi nạp
DELETE FROM `thanh_toan`;
DELETE FROM `mon_an_nguyen_lieu`;
DELETE FROM `nguyen_lieu`;
DELETE FROM `ma_giam_gia`;

ALTER TABLE `thanh_toan` AUTO_INCREMENT = 1;
ALTER TABLE `mon_an_nguyen_lieu` AUTO_INCREMENT = 1;
ALTER TABLE `nguyen_lieu` AUTO_INCREMENT = 1;
ALTER TABLE `ma_giam_gia` AUTO_INCREMENT = 1;

-- ============================================================================
-- 1. NẠP DỮ LIỆU MẪU: nguyen_lieu (Danh sách nguyên liệu & Chỉ số dinh dưỡng)
-- ============================================================================
INSERT INTO `nguyen_lieu` (`ma_nguyen_lieu`, `ten_nguyen_lieu`, `don_vi_tinh`, `calo`, `protein`, `carbs`, `fat`, `don_gia_thay_doi`, `trang_thai`) VALUES
(1, 'Vỏ bánh Burger Sesame', 'cái', 150.00, 5.00, 28.00, 3.00, 10000, 'co_san'),
(2, 'Thịt bò Mỹ nướng', 'miếng', 220.00, 18.00, 0.00, 16.00, 25000, 'co_san'),
(3, 'Phô mai Cheddar', 'lát', 110.00, 7.00, 1.00, 9.00, 10000, 'co_san'),
(4, 'Thịt gà phi lê chiên giòn', 'miếng', 240.00, 20.00, 12.00, 14.00, 20000, 'co_san'),
(5, 'Thịt xông khói Bacon', 'lát', 90.00, 6.00, 0.00, 8.00, 15000, 'co_san'),
(6, 'Rau xà lách tươi', 'phần', 5.00, 0.50, 1.00, 0.10, 3000, 'co_san'),
(7, 'Cà chua lát tươi', 'lát', 10.00, 0.50, 2.00, 0.20, 3000, 'co_san'),
(8, 'Hành tây nướng bơ', 'phần', 15.00, 0.50, 3.00, 0.10, 3000, 'co_san'),
(9, 'Sốt Đặc biệt Fast Food', 'muỗng', 70.00, 0.50, 4.00, 6.00, 5000, 'co_san'),
(10, 'Khoai tây chiên sợi', 'phần', 310.00, 4.00, 41.00, 15.00, 15000, 'co_san');

-- ============================================================================
-- 2. NẠP DỮ LIỆU MẪU: mon_an_nguyen_lieu (Công thức mặc định của các món ăn)
-- ============================================================================
-- 2.1 Món 1: Burger Bò Cực Hạn (ma_mon_an = 1)
INSERT INTO `mon_an_nguyen_lieu` (`ma_mon_an`, `ma_nguyen_lieu`, `so_luong_mac_dinh`, `co_the_tuy_bien`, `so_luong_toi_da`) VALUES
(1, 1, 1.00, 0, 1.00), -- Vỏ bánh (cố định)
(1, 2, 2.00, 1, 4.00), -- 2 miếng Thịt bò (cho phép tăng tối đa 4 miếng)
(1, 3, 2.00, 1, 4.00), -- 2 lát Phô mai (cho phép tăng tối đa 4 lát)
(1, 5, 1.00, 1, 3.00), -- 1 lát Bacon
(1, 6, 1.00, 1, 3.00), -- Xà lách
(1, 7, 1.00, 1, 3.00), -- Cà chua
(1, 9, 1.00, 1, 3.00); -- Sốt đặc biệt

-- 2.2 Món 2: Burger Gà Giòn Sốt Mayo (ma_mon_an = 2)
INSERT INTO `mon_an_nguyen_lieu` (`ma_mon_an`, `ma_nguyen_lieu`, `so_luong_mac_dinh`, `co_the_tuy_bien`, `so_luong_toi_da`) VALUES
(2, 1, 1.00, 0, 1.00), -- Vỏ bánh (cố định)
(2, 4, 1.00, 1, 3.00), -- 1 miếng Gà phi lê chiên giòn
(2, 3, 1.00, 1, 3.00), -- 1 lát Phô mai
(2, 6, 1.00, 1, 3.00), -- Xà lách
(2, 9, 1.00, 1, 3.00); -- Sốt đặc biệt

-- 2.3 Món 3: Gà Rán Giòn Rụm (ma_mon_an = 3)
INSERT INTO `mon_an_nguyen_lieu` (`ma_mon_an`, `ma_nguyen_lieu`, `so_luong_mac_dinh`, `co_the_tuy_bien`, `so_luong_toi_da`) VALUES
(3, 4, 2.00, 1, 5.00); -- 2 miếng Gà chiên giòn

-- 2.4 Món 4: Khoai Tây Chiên (ma_mon_an = 4)
INSERT INTO `mon_an_nguyen_lieu` (`ma_mon_an`, `ma_nguyen_lieu`, `so_luong_mac_dinh`, `co_the_tuy_bien`, `so_luong_toi_da`) VALUES
(4, 10, 1.00, 1, 3.00); -- Khoai tây chiên

-- ============================================================================
-- 3. NẠP DỮ LIỆU MẪU: ma_giam_gia (Danh sách mã khuyến mãi / Voucher)
-- ============================================================================
INSERT INTO `ma_giam_gia` (`ma_voucher`, `ma_code`, `ten_voucher`, `mo_ta`, `loai_giam_gia`, `gia_tri_giam`, `giam_toi_da`, `don_hang_toi_thieu`, `so_luong_phat_hanh`, `so_luong_da_dung`, `ngay_bat_dau`, `ngay_ket_thuc`, `trang_thai`) VALUES
(1, 'FAST30', 'Giảm 30% Đơn Hàng Đầu Tiên', 'Ưu đãi đặc biệt giảm 30% tổng tiền món cho khách hàng mới', 'phan_tram', 30.00, 40000, 100000, 500, 12, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'hoat_dong'),
(2, 'HELLO2026', 'Giảm 20K Trực Tiếp', 'Giảm ngay 20.000 VNĐ cho đơn hàng từ 80.000 VNĐ', 'so_tien', 20000.00, 20000, 80000, 200, 45, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'hoat_dong'),
(3, 'FREESHIP', 'Miễn Phí Vận Chuyển 15K', 'Giảm 15.000 VNĐ phí vận chuyển cho đơn hàng từ 50.000 VNĐ', 'so_tien', 15000.00, 15000, 50000, 1000, 120, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'hoat_dong'),
(4, 'HEALTHY10', 'Ưu Đãi Dinh Dưỡng 10%', 'Giảm 10% khi tùy biến món ăn chuẩn dinh dưỡng', 'phan_tram', 10.00, 25000, 60000, 300, 5, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'hoat_dong');

-- ============================================================================
-- 4. NẠP DỮ LIỆU MẪU: thanh_toan (Nhật ký giao dịch thanh toán mẫu)
-- ============================================================================
INSERT INTO `thanh_toan` (`ma_thanh_toan`, `ma_don_hang`, `phuong_thuc`, `ma_giao_dich_cong`, `so_tien`, `trang_thai_thanh_toan`, `noi_dung_chuyen_khoan`, `ma_qr_code_url`, `ngay_thanh_toan`) VALUES
(1, 1, 'vietqr', 'MBVCB.20260901.10239', 147000, 'thanh_cong', 'FASTFOOD10001', 'https://api.vietqr.io/image/970422-0987654321-FASTFOOD10001.jpg', '2026-09-01 10:32:00'),
(2, 2, 'momo', 'MM2026090199882', 100000, 'thanh_cong', 'FASTFOOD10002', NULL, '2026-09-01 11:15:30'),
(3, 3, 'tien_mat', NULL, 163000, 'cho_thanh_toan', 'FASTFOOD10003', NULL, NULL);

-- Bật lại kiểm tra khóa ngoại
SET FOREIGN_KEY_CHECKS = 1;
