const prisma = require('../utils/prisma');

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
                    include: { user: { select: { firstName: true, lastName: true, role: true } } },
                    orderBy: [
                        { isAccepted: 'desc' },
                        { createdAt: 'asc' }
                    ]
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(forums);
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
                    include: { user: { select: { firstName: true, lastName: true, role: true } } },
                    orderBy: [
                        { isAccepted: 'desc' },
                        { createdAt: 'asc' }
                    ]
                }
            }
        });
        if (!post) return res.status(404).json({ error: 'Post not found' });
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
        const newPost = await prisma.forumPost.create({
            data: {
                appId: id,
                userId: req.user.id,
                title,
                content
            }
        });
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
        const newAnswer = await prisma.forumAnswer.create({
            data: {
                postId: id,
                userId: req.user.id,
                content
            }
        });
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
                return res.status(400).json({ error: 'You have already voted this way' });
            } else {
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

module.exports = {
    getAppForums, getForumPost, createForumPost, addForumAnswer, acceptForumAnswer, deleteForumPost, deleteForumAnswer, voteForumAnswer
};
