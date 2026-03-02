const prisma = require('../utils/prisma');

// Get current logged-in user details
const getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                submittedApps: true,
                reviews: true,
                forumPosts: true,
            },
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // omit password
        const { passwordHash, ...safeUser } = user;
        res.json(safeUser);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching user' });
    }
};

// Update personal account details
const updateMe = async (req, res) => {
    try {
        const { firstName, lastName } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { firstName, lastName },
        });
        const { passwordHash, ...safeUser } = updatedUser;
        res.json(safeUser);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating user' });
    }
};

// (Admin) List all users
const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                createdAt: true,
            }
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching all users' });
    }
};

// (Admin) View specific user activities
const getUserActivities = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                submittedApps: true,
                reviews: true,
                feedback: true,
                forumPosts: true,
                forumAnswers: true,
            }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { passwordHash, ...safeUser } = user;
        res.json(safeUser);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching user activities' });
    }
};

module.exports = { getMe, updateMe, getAllUsers, getUserActivities };
