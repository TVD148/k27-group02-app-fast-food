-- ============================================================================
-- DỰ ÁN: ỨNG DỤNG ĐẶT THỨC ĂN NHANH (FAST FOOD APP)
-- FILE: sprint3_data_update.sql (NẠP DỮ LIỆU MẪU CHO SPRINT 3)
-- NGƯỜI THỰC HIỆN: ĐỖ THỊ MAI HƯƠNG (DATABASE ARCHITECT) & KỸ SƯ DEVOPS
-- ============================================================================

USE `fastfood_db`;

-- Tạm thời tắt kiểm tra khóa ngoại để thực hiện nạp dữ liệu an toàn
SET FOREIGN_KEY_CHECKS = 0;

-- Dọn dẹp dữ liệu cũ của các bảng thuộc Sprint 3 trước khi nạp
DELETE FROM `nhat_ky_thanh_toan`;
DELETE FROM `cong_thuc_mon_an`;
DELETE FROM `nguyen_lieu`;
DELETE FROM `ma_giam_gia`;

ALTER TABLE `nhat_ky_thanh_toan` AUTO_INCREMENT = 1;
ALTER TABLE `cong_thuc_mon_an` AUTO_INCREMENT = 1;
ALTER TABLE `nguyen_lieu` AUTO_INCREMENT = 1;
ALTER TABLE `ma_giam_gia` AUTO_INCREMENT = 1;

-- ============================================================================
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

SET FOREIGN_KEY_CHECKS = 1;
