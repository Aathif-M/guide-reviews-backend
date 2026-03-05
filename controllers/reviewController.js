const prisma = require('../utils/prisma');
const { sendAdminNotification, sendUserNotification } = require('../utils/mailService');

// List ALL reviews (Admin only)
const getAllReviews = async (req, res) => {
    try {
        const reviews = await prisma.review.findMany({
            include: {
                app: { select: { id: true, title: true, logoUrl: true } },
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
        res.status(500).json({ error: 'Server error fetching all reviews' });
    }
};

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

// Fetch 10 most recent APPROVED reviews from any app (Public - used on the Homepage)
const getRecentReviews = async (req, res) => {
    try {
        const reviews = await prisma.review.findMany({
            where: {
                approvalStatus: 'APPROVED'
            },
            include: {
                app: { select: { id: true, title: true, logoUrl: true, category: { select: { iconName: true, name: true } } } },
                user: { select: { firstName: true, lastName: true } },
                questionAnswers: {
                    include: {
                        question: { select: { question: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching recent reviews' });
    }
};

// Submit a review for an app (Auth required, not Admin)
const submitReview = async (req, res) => {
    try {
        const { id } = req.params; // appId
        const { rating, content, answers = [] } = req.body;
        // answers expected format: [{ questionId: '...', answerRating: 4 }, ...]

        if (req.user.role === 'ADMIN') {
            return res.status(403).json({ error: 'Admins cannot submit reviews' });
        }

        // Check if user already reviewed this app
        const existingReview = await prisma.review.findUnique({
            where: {
                appId_userId: {
                    appId: id,
                    userId: req.user.id
                }
            }
        });

        if (existingReview) {
            return res.status(400).json({ error: 'You have already submitted a review for this app. You can edit your existing review instead.' });
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

        const app = await prisma.app.findUnique({ where: { id } });
        sendAdminNotification(
            'New App Review Requires Approval',
            `A new review has been submitted for the app "${app ? app.title : 'Unknown'}" with a rating of ${rating}/5.\n\nReview Content:\n${content}\n\nPlease check the Admin Dashboard.`
        );

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
            data: { approvalStatus: status },
            include: { app: { select: { title: true } }, user: { select: { email: true, firstName: true } } }
        });

        if (status === 'APPROVED' && review.user?.email) {
            sendUserNotification(
                review.user.email,
                `Your Review for ${review.app?.title} has been Approved!`,
                `Hi ${review.user.firstName || 'there'},\n\nGreat news! The review you submitted for "${review.app?.title}" has been read and approved by our moderation team.\n\nYour insight is incredibly valuable and helps other seniors make informed decisions. Thank you for contributing to the G.U.I.D.E. platform!`
            );
        }

        res.json(review);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating review status' });
    }
};

// Edit a review (Must be the author)
const updateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, content, answers = [] } = req.body; // Add answers support to edit

        const review = await prisma.review.findUnique({ where: { id } });
        if (!review) return res.status(404).json({ error: 'Review not found' });

        if (review.userId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized to edit this review' });
        }

        const updatedReview = await prisma.review.update({
            where: { id },
            data: {
                rating,
                content,
                approvalStatus: 'PENDING', // Reset status on edit
                questionAnswers: {
                    deleteMany: {}, // Delete old answers
                    create: answers.map(ans => ({
                        questionId: ans.questionId,
                        answerRating: ans.answerRating
                    }))
                }
            }
        });

        res.json(updatedReview);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating review' });
    }
};

// Delete a review (Author or Admin)
const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;

        const review = await prisma.review.findUnique({ where: { id } });
        if (!review) return res.status(404).json({ error: 'Review not found' });

        if (review.userId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized to delete this review' });
        }

        await prisma.review.delete({ where: { id } });
        res.json({ message: 'Review deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error deleting review' });
    }
};

module.exports = {
    getAppReviews, getRecentReviews, getAllReviews, submitReview, approveReview, updateReview, deleteReview
};
