const prisma = require('../utils/prisma');

// Submit general feedback
const submitFeedback = async (req, res) => {
    try {
        if (req.user.role === 'ADMIN') {
            return res.status(403).json({ error: 'Admins cannot submit feedback' });
        }

        const { content } = req.body;
        const feedback = await prisma.feedback.create({
            data: {
                userId: req.user.id,
                content
            }
        });

        res.status(201).json(feedback);
    } catch (err) {
        res.status(500).json({ error: 'Server error submitting feedback' });
    }
};

// List all feedback (Admin)
const getAllFeedback = async (req, res) => {
    try {
        const feedbackList = await prisma.feedback.findMany({
            include: {
                user: { select: { firstName: true, lastName: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(feedbackList);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching feedback' });
    }
};

// Approve or reject feedback (Admin)
const approveFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'APPROVED' or 'REJECTED'

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const feedback = await prisma.feedback.update({
            where: { id },
            data: { approvalStatus: status }
        });

        res.json(feedback);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating feedback status' });
    }
};

module.exports = {
    submitFeedback, getAllFeedback, approveFeedback
};
