-- ============================================================================
-- DỰ ÁN: ỨNG DỤNG ĐẶT THỨC ĂN NHANH (FAST FOOD APP)
-- FILE: sprint3_data_update.sql (NẠP DỮ LIỆU MẪU CHO SPRINT 3)
<<<<<<< HEAD
-- NGƯỜI THỰC HIỆN: CHUYÊN GIA DATABASE (MYSQL) & KỸ SƯ DEVOPS
=======
-- NGƯỜI THỰC HIỆN: ĐỖ THỊ MAI HƯƠNG (DATABASE ARCHITECT) & KỸ SƯ DEVOPS
>>>>>>> origin/database
-- ============================================================================

USE `fastfood_db`;

-- Tạm thời tắt kiểm tra khóa ngoại để thực hiện nạp dữ liệu an toàn
SET FOREIGN_KEY_CHECKS = 0;

-- Dọn dẹp dữ liệu cũ của các bảng thuộc Sprint 3 trước khi nạp
<<<<<<< HEAD
DELETE FROM `thanh_toan`;
DELETE FROM `mon_an_nguyen_lieu`;
DELETE FROM `nguyen_lieu`;
DELETE FROM `ma_giam_gia`;

ALTER TABLE `thanh_toan` AUTO_INCREMENT = 1;
ALTER TABLE `mon_an_nguyen_lieu` AUTO_INCREMENT = 1;
=======
DELETE FROM `nhat_ky_thanh_toan`;
DELETE FROM `cong_thuc_mon_an`;
DELETE FROM `nguyen_lieu`;
DELETE FROM `ma_giam_gia`;

ALTER TABLE `nhat_ky_thanh_toan` AUTO_INCREMENT = 1;
ALTER TABLE `cong_thuc_mon_an` AUTO_INCREMENT = 1;
>>>>>>> origin/database
ALTER TABLE `nguyen_lieu` AUTO_INCREMENT = 1;
ALTER TABLE `ma_giam_gia` AUTO_INCREMENT = 1;

-- ============================================================================
<<<<<<< HEAD
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
=======
-- 1. NẠP DỮ LIỆU: nguyen_lieu (Danh sách nguyên liệu dinh dưỡng)
-- ============================================================================
INSERT INTO `nguyen_lieu` (`ma_nguyen_lieu`, `ten_nguyen_lieu`, `calo`, `protein`, `carbs`, `fat`, `don_vi_tinh`) VALUES
(1, 'Thịt bò', 250.00, 26.00, 0.00, 17.00, 'gram'),
(2, 'Thịt gà', 165.00, 31.00, 0.00, 3.60, 'gram'),
(3, 'Vỏ bánh burger', 120.00, 4.00, 22.00, 1.50, 'cai'),
(4, 'Phô mai Cheddar', 113.00, 7.00, 0.40, 9.00, 'lat'),
(5, 'Khoai tây', 77.00, 2.00, 17.00, 0.10, 'gram'),
(6, 'Sốt Mayonnaise', 94.00, 0.10, 0.10, 10.00, 'ml'),
(7, 'Siro Pepsi', 150.00, 0.00, 41.00, 0.00, 'ml');

-- ============================================================================
-- 2. NẠP DỮ LIỆU: cong_thuc_mon_an (Gắn nguyên liệu vào các món ăn)
-- ============================================================================
INSERT INTO `cong_thuc_mon_an` (`ma_mon_an`, `ma_nguyen_lieu`, `dinh_luong_mac_dinh`) VALUES
-- Burger Bò Cực Hạn (ma_mon_an = 1)
(1, 3, 1.00),   -- 1 Vỏ bánh burger
(1, 1, 150.00), -- 150g Thịt bò Úc nướng
(1, 4, 2.00),   -- 2 Lát phô mai Cheddar
(1, 6, 15.00),  -- 15ml Sốt Mayonnaise

-- Burger Gà Giòn Sốt Mayo (ma_mon_an = 2)
(2, 3, 1.00),   -- 1 Vỏ bánh burger
(2, 2, 120.00), -- 120g Thịt gà phi-lê chiên
(2, 4, 1.00),   -- 1 Lát phô mai Cheddar
(2, 6, 15.00),  -- 15ml Sốt Mayonnaise

-- Khoai Tây Chiên Cỡ Vừa (ma_mon_an = 4)
(4, 5, 150.00); -- 150g Khoai tây cắt lát chiên

-- ============================================================================
-- 3. NẠP DỮ LIỆU: ma_giam_gia (Mã giảm giá/Voucher khuyến mãi)
-- ============================================================================
INSERT INTO `ma_giam_gia` (`ma_voucher`, `code_voucher`, `mo_ta`, `loai_giam_gia`, `gia_tri_giam`, `gia_tri_don_toi_thieu`, `giam_toi_da`, `so_luong_luot_dung`, `ngay_bat_dau`, `ngay_ket_thuc`, `trang_thai`) VALUES
(1, 'HE2026', 'Voucher chào hè giảm 10% cho đơn hàng từ 100k, giảm tối đa 30k', 'phan_tram', 10.00, 100000, 30000, 100, '2026-06-01 00:00:00', '2026-09-30 23:59:59', 'hoat_dong'),
(2, 'FASTFOOD15K', 'Giảm trực tiếp 15.000đ cho đơn hàng có giá trị tối thiểu từ 80k', 'so_tien', 15000.00, 80000, 15000, 200, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'hoat_dong'),
(3, 'VIPFAST', 'Voucher tri ân VIP giảm 20% cho đơn từ 150k, giảm tối đa 50k', 'phan_tram', 20.00, 150000, 50000, 50, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'hoat_dong');

-- ============================================================================
-- 4. NẠP DỮ LIỆU: nhat_ky_thanh_toan (Nhật ký giao dịch mẫu)
-- ============================================================================
INSERT INTO `nhat_ky_thanh_toan` (`ma_giao_dich`, `ma_don_hang`, `cong_thanh_toan`, `ma_giao_dich_cong`, `so_tien`, `trang_thai_giao_dich`, `noi_dung_phan_hoi`, `thoi_gian_tao`) VALUES
-- 1 log MoMo thành công cho ma_don_hang = 2 (Tổng thanh toán 154,000đ)
(1, 2, 'momo', 'MM20260831998877', 154000, 'thanh_cong', '{"partnerCode": "MOMO", "orderId": "DH2", "amount": 154000, "message": "Success", "resultCode": 0}', '2026-08-31 10:15:00'),

-- 1 log VNPay thất bại cho ma_don_hang = 1 (Tổng thanh toán 126,000đ)
(2, 1, 'vnpay', 'VN20260831112233', 126000, 'that_bai', '{"vnp_ResponseCode": "24", "vnp_TxnRef": "DH1", "vnp_Amount": 12600000, "message": "Khách hàng hủy giao dịch"}', '2026-08-31 09:30:00');

>>>>>>> origin/database
SET FOREIGN_KEY_CHECKS = 1;
