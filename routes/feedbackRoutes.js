const express = require('express');
const { submitFeedback, getAllFeedback, approveFeedback } = require('../controllers/feedbackController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.post('/', authMiddleware, submitFeedback);
router.get('/', authMiddleware, roleMiddleware(['ADMIN']), getAllFeedback);
router.patch('/:id/approve', authMiddleware, roleMiddleware(['ADMIN']), approveFeedback);

module.exports = router;
