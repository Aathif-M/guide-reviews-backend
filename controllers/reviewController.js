const prisma = require('../utils/prisma');

// List reviews for an app (Approved only)
const getAppReviews = async (req, res) => {
    try {
        const { id } = req.params; // appId
        const reviews = await prisma.review.findMany({
            where: {
                appId: id,
                approvalStatus: 'APPROVED'
            },
            include: {
                user: { select: { firstName: true, lastName: true } },
                questionAnswers: {
                    include: {
                        question: { select: { question: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching reviews' });
    }
};

// Submit a review for an app (Auth required, not Admin)
const submitReview = async (req, res) => {
    try {
        const { id } = req.params; // appId
        const { rating, content, answers } = req.body;
        // answers expected format: [{ questionId: '...', answerRating: 4 }, ...]

        if (req.user.role === 'ADMIN') {
            return res.status(403).json({ error: 'Admins cannot submit reviews' });
        }

        const newReview = await prisma.review.create({
            data: {
                appId: id,
                userId: req.user.id,
                rating,
                content,
                questionAnswers: {
                    create: answers.map(ans => ({
                        questionId: ans.questionId,
                        answerRating: ans.answerRating
                    }))
                }
            }
        });

        res.status(201).json(newReview);
    } catch (err) {
        res.status(500).json({ error: 'Server error submitting review' });
    }
};

// Approve or reject a review (Admin)
const approveReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'APPROVED' or 'REJECTED'

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const review = await prisma.review.update({
            where: { id },
            data: { approvalStatus: status }
        });

        res.json(review);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating review status' });
    }
};

module.exports = {
    getAppReviews, submitReview, approveReview
};
