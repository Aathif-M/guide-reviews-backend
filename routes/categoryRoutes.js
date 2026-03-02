const express = require('express');
const {
    getCategories, createCategory, updateCategory, deleteCategory,
    getCategoryQuestions, addCategoryQuestion, updateCategoryQuestion, deleteCategoryQuestion
} = require('../controllers/categoryController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', getCategories);
router.post('/', authMiddleware, roleMiddleware(['ADMIN']), createCategory);
router.put('/:id', authMiddleware, roleMiddleware(['ADMIN']), updateCategory);
router.delete('/:id', authMiddleware, roleMiddleware(['ADMIN']), deleteCategory);

router.get('/:id/questions', getCategoryQuestions);
router.post('/:id/questions', authMiddleware, roleMiddleware(['ADMIN']), addCategoryQuestion);

// routes that don't need categoryId in the path (using question id)
router.put('/questions/:id', authMiddleware, roleMiddleware(['ADMIN']), updateCategoryQuestion);
router.delete('/questions/:id', authMiddleware, roleMiddleware(['ADMIN']), deleteCategoryQuestion);

module.exports = router;
