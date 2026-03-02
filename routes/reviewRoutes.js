const express = require('express');
const { getAppReviews, submitReview, approveReview } = require('../controllers/reviewController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

// the route will be mounted on /api/v1/apps or reviews
// we'll put /apps/:id/reviews inside appRoutes using mounting or keeping it here.
// we mount this separately but use full path for clarity when attaching to index.

// We will export a router and also attach full routes in index or keep it split.
// Actually, it's easier to mount this directly at /api/v1

router.get('/apps/:id/reviews', getAppReviews);
router.post('/apps/:id/reviews', authMiddleware, submitReview);

router.patch('/reviews/:id/approve', authMiddleware, roleMiddleware(['ADMIN']), approveReview);

module.exports = router;
