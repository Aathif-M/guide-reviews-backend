const prisma = require('../utils/prisma');

/**
 * Retrieve profile information for the currently authenticated User.
 * Includes nested relations like submitted apps, reviews, and forum posts.
 * Automatically redacts sensitive fields like Password Hashes.
 */
const getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                submittedApps: true,
                reviews: {
                    include: {
                        app: { select: { title: true } }
                    }
                },
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

/**
 * Update personal profile information.
 * Allows users to update their first name and last name.
 */
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

/**
 * (Admin Only) Fetches a list of all users registered on the platform.
 * Returns sanitized basic information, including current suspension status and role type.
 */
const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isSuspended: true,
                createdAt: true,
            }
        });
        res.json(users);
    } catch (err) {
        console.error('Error in getAllUsers:', err);
        res.status(500).json({ error: 'Server error fetching all users', details: err.message });
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

/**
 * (Admin Only) Toggles the suspension status for a specific user.
 * Suspended users cannot perform authorized actions. Admins cannot be suspended.
 */
const toggleUserSuspension = async (req, res) => {
    try {
        const { id } = req.params;
        const { isSuspended } = req.body;

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'ADMIN') return res.status(400).json({ error: 'Cannot suspend an admin user' });

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { isSuspended },
        });

        res.json({ message: `User successfully ${isSuspended ? 'suspended' : 'unsuspended'}`, user: updatedUser });
    } catch (err) {
        res.status(500).json({ error: 'Server error updating user suspension status' });
    }
};

module.exports = { getMe, updateMe, getAllUsers, getUserActivities, toggleUserSuspension };
