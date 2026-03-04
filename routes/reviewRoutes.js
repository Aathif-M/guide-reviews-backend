const express = require('express');
const { getAppReviews, getRecentReviews, getAllReviews, submitReview, approveReview, updateReview, deleteReview } = require('../controllers/reviewController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

// the route will be mounted on /api/v1/apps or reviews
// we'll put /apps/:id/reviews inside appRoutes using mounting or keeping it here.
// we mount this separately but use full path for clarity when attaching to index.

// We will export a router and also attach full routes in index or keep it split.
// Admin Routes
router.get('/reviews', authMiddleware, roleMiddleware(['ADMIN']), getAllReviews);

router.get('/reviews/recent', getRecentReviews);

router.get('/apps/:id/reviews', getAppReviews);
router.post('/apps/:id/reviews', authMiddleware, submitReview);

router.put('/reviews/:id', authMiddleware, updateReview);
router.delete('/reviews/:id', authMiddleware, deleteReview);

router.patch('/reviews/:id/approve', authMiddleware, roleMiddleware(['ADMIN']), approveReview);

module.exports = router;
