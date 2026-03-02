const prisma = require('../utils/prisma');

// List apps (returns APPROVED apps for general users, ALL for admin)
const getApps = async (req, res) => {
    try {
        const { category, search } = req.query;

        // Determine filter based on role (admins see all, users see approved)
        let whereClause = {};
        if (!req.user || req.user.role !== 'ADMIN') {
            whereClause.approvalStatus = 'APPROVED';
        }

        if (category) {
            whereClause.categoryId = category;
        }

        if (search) {
            whereClause.title = { contains: search, mode: 'insensitive' };
        }

        const apps = await prisma.app.findMany({
            where: whereClause,
            include: {
                category: true,
            }
        });

        res.json(apps);
    } catch (err) {
        res.status(500).json({ error: 'Server error parsing apps' });
    }
};

// Get app details
const getAppById = async (req, res) => {
    try {
        const { id } = req.params;
        const app = await prisma.app.findUnique({
            where: { id },
            include: {
                category: true,
                submitter: { select: { id: true, firstName: true, lastName: true } },
                reviews: {
                    where: { approvalStatus: 'APPROVED' },
                    include: { user: { select: { firstName: true, lastName: true } } }
                }
            }
        });

        if (!app) return res.status(404).json({ error: 'App not found' });

        // Non-admins shouldn't see unapproved apps
        if (app.approvalStatus !== 'APPROVED' && (!req.user || req.user.role !== 'ADMIN')) {
            return res.status(403).json({ error: 'Access denied: App not approved yet' });
        }

        res.json(app);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching app details' });
    }
};

// Submit a new app (Auth required)
const submitApp = async (req, res) => {
    try {
        const { title, description, playstoreLink, appstoreLink, youtubeTutorialUrl, categoryId } = req.body;

        const newApp = await prisma.app.create({
            data: {
                title,
                description,
                playstoreLink,
                appstoreLink,
                youtubeTutorialUrl,
                categoryId,
                submitterId: req.user.id,
            }
        });

        res.status(201).json(newApp);
    } catch (err) {
        res.status(500).json({ error: 'Server error submitting app' });
    }
};

// Edit an app (Admin)
const updateApp = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, playstoreLink, appstoreLink, youtubeTutorialUrl, categoryId } = req.body;

        const app = await prisma.app.update({
            where: { id },
            data: { title, description, playstoreLink, appstoreLink, youtubeTutorialUrl, categoryId }
        });

        res.json(app);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating app' });
    }
};

// Delete an app (Admin)
const deleteApp = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.app.delete({ where: { id } });
        res.json({ message: 'App deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error deleting app' });
    }
};

// Approve or reject an app (Admin)
const approveApp = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'APPROVED' or 'REJECTED'

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const app = await prisma.app.update({
            where: { id },
            data: {
                approvalStatus: status,
                approverId: req.user.id
            }
        });

        res.json(app);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating app status' });
    }
};

module.exports = {
    getApps, getAppById, submitApp, updateApp, deleteApp, approveApp
};
