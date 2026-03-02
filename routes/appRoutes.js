const express = require('express');
const {
    getApps, getAppById, submitApp, updateApp, deleteApp, approveApp
} = require('../controllers/appController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

// Optional auth for getApps and getAppById to check admin status, but don't strictly require it
const optionalAuth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
        const jwt = require('jsonwebtoken');
        try {
            req.user = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) { /* ignore invalid token for optional auth */ }
    }
    next();
};

router.get('/', optionalAuth, getApps);
router.get('/:id', optionalAuth, getAppById);

router.post('/', authMiddleware, submitApp);

// Admin-only application management
router.put('/:id', authMiddleware, roleMiddleware(['ADMIN']), updateApp);
router.delete('/:id', authMiddleware, roleMiddleware(['ADMIN']), deleteApp);
router.patch('/:id/approve', authMiddleware, roleMiddleware(['ADMIN']), approveApp);

module.exports = router;
