const express = require('express');
const router = express.Router();
const { 
  getAllIngredients, 
  getItemDefaultNutrition, 
  calculateCustomNutrition 
} = require('../controllers/nutritionController');

// Route 1: Lấy danh sách toàn bộ nguyên liệu & chỉ số dinh dưỡng
router.get('/ingredients', getAllIngredients);

// Route 2: Lấy công thức & định lượng dinh dưỡng mặc định của món ăn
router.get('/item/:itemId', getItemDefaultNutrition);

// Route 3: Tính toán động chỉ số Calo, Protein, Carbs, Fat khi khách tùy biến nguyên liệu (Killer Feature)
router.post('/calculate', calculateCustomNutrition);

module.exports = router;
