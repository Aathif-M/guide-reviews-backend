const express = require('express');
const { getMe, updateMe, getAllUsers, getUserActivities, toggleUserSuspension } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateMe);

// Admin only routes
router.get('/', authMiddleware, roleMiddleware(['ADMIN']), getAllUsers);
router.get('/:id/activities', authMiddleware, roleMiddleware(['ADMIN']), getUserActivities);
router.patch('/:id/suspend', authMiddleware, roleMiddleware(['ADMIN']), toggleUserSuspension);

module.exports = router;
