const prisma = require('../utils/prisma');
const { sendAdminNotification } = require('../utils/mailService');

// List forum posts for an app
const getAppForums = async (req, res) => {
    try {
        const { id } = req.params; // appId
        const forums = await prisma.forumPost.findMany({
            where: { appId: id },
            include: {
                user: { select: { firstName: true, lastName: true } },
                _count: { select: { answers: true } },
                answers: {
                    where: {
                        OR: [
                            { approvalStatus: 'APPROVED' },
                            ...(req.user?.id ? [{ userId: req.user.id }] : [])
                        ]
                    },
                    include: {
                        user: { select: { firstName: true, lastName: true, role: true } },
                        votes: { select: { userId: true, voteType: true } }
                    },
                    orderBy: [
                        { isAccepted: 'desc' },
                        { createdAt: 'asc' }
                    ]
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Filter returned forums if not an admin
        let result = forums;
        if (req.user?.role !== 'ADMIN') {
            result = forums.filter(post => post.approvalStatus === 'APPROVED' || post.userId === req.user?.id);
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching forums' });
    }
};

// Get specific forum post and its answers
const getForumPost = async (req, res) => {
    try {
        const { id } = req.params; // postId
        const post = await prisma.forumPost.findUnique({
            where: { id },
            include: {
                user: { select: { firstName: true, lastName: true } },
                answers: {
                    where: {
                        OR: [
                            { approvalStatus: 'APPROVED' },
                            ...(req.user?.id ? [{ userId: req.user.id }] : [])
                        ]
                    },
                    include: { user: { select: { firstName: true, lastName: true, role: true } } },
                    orderBy: [
                        { isAccepted: 'desc' },
                        { createdAt: 'asc' }
                    ]
                }
            }
        });
        if (!post) return res.status(404).json({ error: 'Post not found' });

        // Block access to unapproved post for non-admin, non-author
        if (post.approvalStatus !== 'APPROVED' && req.user?.role !== 'ADMIN' && post.userId !== req.user?.id) {
            return res.status(403).json({ error: 'Access denied to unapproved post' });
        }

        // If admin, they might want all answers regardless of approval, so re-fetch answers if admin
        if (req.user?.role === 'ADMIN') {
            const allAnswers = await prisma.forumAnswer.findMany({
                where: { postId: id },
                include: { user: { select: { firstName: true, lastName: true, role: true } } },
                orderBy: [
                    { isAccepted: 'desc' },
                    { createdAt: 'asc' }
                ]
            });
            post.answers = allAnswers;
        }

        res.json(post);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching post' });
    }
};

// Create a new forum post
const createForumPost = async (req, res) => {
    try {
        const { id } = req.params; // appId
        const { title, content } = req.body;
        const approvalStatus = req.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING';
        const newPost = await prisma.forumPost.create({
            data: {
                appId: id,
                userId: req.user.id,
                title,
                content,
                approvalStatus
            },
            include: { user: { select: { firstName: true, lastName: true } }, app: { select: { title: true } } }
        });

        // Send email to admins only if pending
        if (approvalStatus === 'PENDING') {
            sendAdminNotification(
                'New Forum Question Needs Approval',
                `User ${newPost.user.firstName} ${newPost.user.lastName} submitted a new question for the app "${newPost.app.title}".\n\nTitle: ${newPost.title}\nContent: ${newPost.content}`
            );
        }

        res.status(201).json(newPost);
    } catch (err) {
        res.status(500).json({ error: 'Server error creating post' });
    }
};

// Add answer to a post
const addForumAnswer = async (req, res) => {
    try {
        const { id } = req.params; // postId
        const { content } = req.body;
        const approvalStatus = req.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING';
        const newAnswer = await prisma.forumAnswer.create({
            data: {
                postId: id,
                userId: req.user.id,
                content,
                approvalStatus
            },
            include: { user: { select: { firstName: true, lastName: true } }, post: { select: { title: true } } }
        });

        // Send email to admins only if pending
        if (approvalStatus === 'PENDING') {
            sendAdminNotification(
                'New Forum Answer Needs Approval',
                `User ${newAnswer.user.firstName} ${newAnswer.user.lastName} submitted a new answer on the question "${newAnswer.post.title}".\n\nAnswer: ${newAnswer.content}`
            );
        }

        res.status(201).json(newAnswer);
    } catch (err) {
        res.status(500).json({ error: 'Server error adding answer' });
    }
};

// Mark an answer as accepted (Only post author allowed)
const acceptForumAnswer = async (req, res) => {
    try {
        const { id } = req.params; // answerId

        const answer = await prisma.forumAnswer.findUnique({
            where: { id },
            include: { post: true }
        });

        if (!answer) return res.status(404).json({ error: 'Answer not found' });

        // Validate if current user is the post author OR an ADMIN
        if (answer.post.userId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Only post creator can accept answers' });
        }

        // Unaccept any previously accepted answers for this post
        await prisma.forumAnswer.updateMany({
            where: { postId: answer.postId, isAccepted: true },
            data: { isAccepted: false }
        });

        // Accept this answer
        const acceptedAnswer = await prisma.forumAnswer.update({
            where: { id },
            data: { isAccepted: true }
        });

        res.json(acceptedAnswer);
    } catch (err) {
        res.status(500).json({ error: 'Server error accepting answer' });
    }
};

// Delete a forum post (Admin only)
const deleteForumPost = async (req, res) => {
    try {
        const { id } = req.params;
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Permission denied' });
        }
        await prisma.forumPost.delete({ where: { id } });
        res.json({ message: 'Forum post deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error deleting forum post' });
    }
};

// Delete a forum answer (Admin only)
const deleteForumAnswer = async (req, res) => {
    try {
        const { id } = req.params;
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Permission denied' });
        }
        await prisma.forumAnswer.delete({ where: { id } });
        res.json({ message: 'Forum answer deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error deleting forum answer' });
    }
};

// Upvote or Downvote an answer
const voteForumAnswer = async (req, res) => {
    try {
        const { id } = req.params; // answerId
        const { vote } = req.body; // 1 for upvote, -1 for downvote

        if (![1, -1].includes(vote)) return res.status(400).json({ error: 'Invalid vote type' });

        const answer = await prisma.forumAnswer.findUnique({ where: { id } });
        if (!answer) return res.status(404).json({ error: 'Answer not found' });

        const existingVote = await prisma.forumAnswerVote.findUnique({
            where: {
                answerId_userId: {
                    answerId: id,
                    userId: req.user.id
                }
            }
        });

        if (existingVote) {
            if (existingVote.voteType === vote) {
                // User clicked the same vote type again -> Remove the vote
                await prisma.$transaction([
                    prisma.forumAnswerVote.delete({
                        where: { id: existingVote.id }
                    }),
                    prisma.forumAnswer.update({
                        where: { id },
                        data: {
                            upvotes: vote === 1 ? { decrement: 1 } : undefined,
                            downvotes: vote === -1 ? { decrement: 1 } : undefined
                        }
                    })
                ]);
                return res.json({ message: 'Vote removed successfully' });
            } else {
                // User changed their vote
                await prisma.$transaction([
                    prisma.forumAnswerVote.update({
                        where: { id: existingVote.id },
                        data: { voteType: vote }
                    }),
                    prisma.forumAnswer.update({
                        where: { id },
                        data: {
                            upvotes: vote === 1 ? { increment: 1 } : { decrement: 1 },
                            downvotes: vote === -1 ? { increment: 1 } : { decrement: 1 }
                        }
                    })
                ]);
                return res.json({ message: 'Vote changed successfully' });
            }
        }

        await prisma.$transaction([
            prisma.forumAnswerVote.create({
                data: {
                    answerId: id,
                    userId: req.user.id,
                    voteType: vote
                }
            }),
            prisma.forumAnswer.update({
                where: { id },
                data: {
                    upvotes: vote === 1 ? { increment: 1 } : undefined,
                    downvotes: vote === -1 ? { increment: 1 } : undefined
                }
            })
        ]);

        res.json({ message: 'Vote added successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error handling vote' });
    }
};

// Admin endpoints for Moderation

const getPendingForumItems = async (req, res) => {
    try {
        const pendingPosts = await prisma.forumPost.findMany({
            include: {
                user: { select: { firstName: true, lastName: true } },
                app: { select: { title: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const pendingAnswers = await prisma.forumAnswer.findMany({
            include: {
                user: { select: { firstName: true, lastName: true } },
                post: { select: { title: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ posts: pendingPosts, answers: pendingAnswers });
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching pending items' });
    }
};

const approveForumPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { approvalStatus, status } = req.body; // 'APPROVED' or 'REJECTED'
        const finalStatus = approvalStatus || status;

        if (!['APPROVED', 'REJECTED'].includes(finalStatus)) {
            return res.status(400).json({ error: 'Invalid approval status' });
        }

        const updatedPost = await prisma.forumPost.update({
            where: { id },
            data: { approvalStatus: finalStatus }
        });
        res.json(updatedPost);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating approval status' });
    }
};

const approveForumAnswer = async (req, res) => {
    try {
        const { id } = req.params;
        const { approvalStatus, status } = req.body;
        const finalStatus = approvalStatus || status;

        if (!['APPROVED', 'REJECTED'].includes(finalStatus)) {
            return res.status(400).json({ error: 'Invalid approval status' });
        }

        const updatedAnswer = await prisma.forumAnswer.update({
            where: { id },
            data: { approvalStatus: finalStatus }
        });
        res.json(updatedAnswer);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating approval status' });
    }
};


module.exports = {
    getAppForums, getForumPost, createForumPost, addForumAnswer, acceptForumAnswer,
    deleteForumPost, deleteForumAnswer, voteForumAnswer,
    getPendingForumItems, approveForumPost, approveForumAnswer
};
