const express = require('express');
const { getAppForums, getForumPost, createForumPost, addForumAnswer, acceptForumAnswer, deleteForumPost, deleteForumAnswer } = require('../controllers/forumController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/apps/:id/forums', getAppForums);
router.post('/apps/:id/forums', authMiddleware, createForumPost);

router.get('/forums/posts/:id', getForumPost);
router.post('/forums/posts/:id/answers', authMiddleware, addForumAnswer);
router.delete('/forums/posts/:id', authMiddleware, deleteForumPost);

router.patch('/forums/answers/:id/accept', authMiddleware, acceptForumAnswer);
router.delete('/forums/answers/:id', authMiddleware, deleteForumAnswer);

module.exports = router;
