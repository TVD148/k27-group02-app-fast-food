const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { verifyToken } = require('../middlewares/auth');

// Toàn bộ các route sổ địa chỉ đều yêu cầu đăng nhập (verifyToken)
router.get('/', verifyToken, addressController.getAddresses);
router.post('/', verifyToken, addressController.createAddress);
router.put('/:id', verifyToken, addressController.updateAddress);
router.put('/:id/default', verifyToken, addressController.setDefaultAddress);
router.delete('/:id', verifyToken, addressController.deleteAddress);

module.exports = router;
