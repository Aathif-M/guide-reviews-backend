const prisma = require('../utils/prisma');

// List all categories
const getCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            include: { questions: true }
        });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: 'Server error parsing categories' });
    }
};

// Add new category (Admin)
const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const newCategory = await prisma.category.create({
            data: { name, description }
        });
        res.status(201).json(newCategory);
    } catch (err) {
        if (err.code === 'P2002') return res.status(400).json({ error: 'Category name already exists' });
        res.status(500).json({ error: 'Server error creating category' });
    }
};

// Edit category (Admin)
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const category = await prisma.category.update({
            where: { id },
            data: { name, description }
        });
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating category' });
    }
};

// Delete category (Admin)
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.category.delete({ where: { id } });
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error deleting category' });
    }
};

// List heuristics questions for a category
const getCategoryQuestions = async (req, res) => {
    try {
        const { id } = req.params;
        const questions = await prisma.categoryQuestion.findMany({
            where: { categoryId: id }
        });
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching questions' });
    }
};

// Add heuristic question (Admin)
const addCategoryQuestion = async (req, res) => {
    try {
        const { id } = req.params; // categoryId
        const { question } = req.body;
        const newQuestion = await prisma.categoryQuestion.create({
            data: {
                categoryId: id,
                question
            }
        });
        res.status(201).json(newQuestion);
    } catch (err) {
        res.status(500).json({ error: 'Server error adding question' });
    }
};

// Edit heuristic question (Admin)
const updateCategoryQuestion = async (req, res) => {
    try {
        const { id } = req.params; // questionId
        const { question } = req.body;
        const updated = await prisma.categoryQuestion.update({
            where: { id },
            data: { question }
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating question' });
    }
};

// Delete heuristic question (Admin)
const deleteCategoryQuestion = async (req, res) => {
    try {
        const { id } = req.params; // questionId
        await prisma.categoryQuestion.delete({ where: { id } });
        res.json({ message: 'Question deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error deleting question' });
    }
};

module.exports = {
    getCategories, createCategory, updateCategory, deleteCategory,
    getCategoryQuestions, addCategoryQuestion, updateCategoryQuestion, deleteCategoryQuestion
};
