const express = require('express');
const { getAppForums, getForumPost, createForumPost, addForumAnswer, acceptForumAnswer, deleteForumPost, deleteForumAnswer, voteForumAnswer, getPendingForumItems, approveForumPost, approveForumAnswer } = require('../controllers/forumController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Optional auth for getAppForums to check admin status
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

const router = express.Router();

router.get('/apps/:id/forums', optionalAuth, getAppForums);
router.post('/apps/:id/forums', authMiddleware, createForumPost);

router.get('/forums/posts/:id', getForumPost);
router.post('/forums/posts/:id/answers', authMiddleware, addForumAnswer);
router.delete('/forums/posts/:id', authMiddleware, deleteForumPost);

router.patch('/forums/answers/:id/accept', authMiddleware, acceptForumAnswer);
router.post('/forums/answers/:id/vote', authMiddleware, voteForumAnswer);
router.delete('/forums/answers/:id', authMiddleware, deleteForumAnswer);

// Admin Moderation Routes
router.get('/forums/pending', authMiddleware, roleMiddleware(['ADMIN']), getPendingForumItems);
router.patch('/forums/posts/:id/approve', authMiddleware, roleMiddleware(['ADMIN']), approveForumPost);
router.patch('/forums/answers/:id/approve', authMiddleware, roleMiddleware(['ADMIN']), approveForumAnswer);

module.exports = router;
