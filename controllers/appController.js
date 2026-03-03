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
                reviews: {
                    where: { approvalStatus: 'APPROVED' },
                    include: { questionAnswers: true } // Need answers for calculation
                }
            }
        });

        // Compute aggregated rating for all apps in the list
        const appsResponse = apps.map(app => {
            let aggregatedRating = 0;
            if (app.reviews.length > 0) {
                let totalGeneralStars = 0;
                let totalQuestionScore = 0;
                let questionAnswerCount = 0;

                app.reviews.forEach(review => {
                    totalGeneralStars += review.rating;

                    if (review.questionAnswers && review.questionAnswers.length > 0) {
                        review.questionAnswers.forEach(qa => {
                            totalQuestionScore += qa.answerRating;
                            questionAnswerCount++;
                        });
                    }
                });

                const avgGeneralRating = totalGeneralStars / app.reviews.length; // Max 5

                // Convert questions to 5-point scale
                let avgQuestionRating = 0;
                if (questionAnswerCount > 0) {
                    avgQuestionRating = (totalQuestionScore / questionAnswerCount) / 2;
                }

                // 50% custom questions, 50% user general rating
                if (avgQuestionRating > 0) {
                    aggregatedRating = (avgGeneralRating * 0.5) + (avgQuestionRating * 0.5);
                } else {
                    aggregatedRating = avgGeneralRating;
                }
            }

            return {
                ...app,
                computedRating: Number(aggregatedRating.toFixed(1))
            };
        });

        res.json(appsResponse);
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
                category: { include: { questions: true } },
                tutorials: true,
                submitter: { select: { id: true, firstName: true, lastName: true } },
                reviews: {
                    where: req.user && req.user.role === 'ADMIN'
                        ? undefined
                        : req.user
                            ? { OR: [{ approvalStatus: 'APPROVED' }, { userId: req.user.id }] }
                            : { approvalStatus: 'APPROVED' },
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true } },
                        questionAnswers: true // important to fetch answers for calculating total score
                    }
                }
            }
        });

        if (!app) return res.status(404).json({ error: 'App not found' });

        // Non-admins shouldn't see unapproved apps
        if (app.approvalStatus !== 'APPROVED' && (!req.user || req.user.role !== 'ADMIN')) {
            return res.status(403).json({ error: 'Access denied: App not approved yet' });
        }

        // Calculate comprehensive aggregated rating strictly for APPROVED reviews
        let aggregatedRating = 0;
        const approvedReviews = app.reviews.filter(r => r.approvalStatus === 'APPROVED');

        if (approvedReviews.length > 0) {
            let totalGeneralStars = 0;
            let totalQuestionScore = 0;
            let questionAnswerCount = 0;

            approvedReviews.forEach(review => {
                totalGeneralStars += review.rating;

                if (review.questionAnswers && review.questionAnswers.length > 0) {
                    review.questionAnswers.forEach(qa => {
                        totalQuestionScore += qa.answerRating;
                        questionAnswerCount++;
                    });
                }
            });

            const avgGeneralRating = totalGeneralStars / approvedReviews.length; // Max 5

            // Convert questions to 5-point scale (since they are out of 10)
            let avgQuestionRating = 0;
            if (questionAnswerCount > 0) {
                // Average of out of 10, divided by 2 to map to 5-point scale
                avgQuestionRating = (totalQuestionScore / questionAnswerCount) / 2;
            }

            // Calculation algorithm: 50% weight to custom questions, 50% to user standard star rating
            if (avgQuestionRating > 0) {
                aggregatedRating = (avgGeneralRating * 0.5) + (avgQuestionRating * 0.5);
            } else {
                aggregatedRating = avgGeneralRating;
            }
        }

        const appResponse = {
            ...app,
            computedRating: Number(aggregatedRating.toFixed(1))
        };

        res.json(appResponse);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching app details' });
    }
};

// Submit a new app (Auth required)
const submitApp = async (req, res) => {
    try {
        const { title, description, playstoreLink, appstoreLink, categoryId } = req.body;

        let tutorials = [];
        if (req.body.tutorials) {
            try {
                tutorials = JSON.parse(req.body.tutorials);
            } catch (e) {
                // If it fails to parse, ignore
            }
        }

        let logoUrl = req.body.logoUrl; // Fallback if still passing string
        if (req.file) {
            // e.g. /uploads/logo-123.png
            logoUrl = `/uploads/${req.file.filename}`;
        }

        const newApp = await prisma.app.create({
            data: {
                title,
                description,
                logoUrl,
                playstoreLink,
                appstoreLink,
                categoryId,
                submitterId: req.user.id,
                tutorials: {
                    create: tutorials.map(t => ({
                        title: t.title,
                        videoUrl: t.url
                    }))
                }
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
        const { title, description, logoUrl, playstoreLink, appstoreLink, categoryId } = req.body;
        let tutorials = req.body.tutorials || [];

        const app = await prisma.app.update({
            where: { id },
            data: {
                title,
                description,
                logoUrl,
                playstoreLink,
                appstoreLink,
                categoryId,
                tutorials: {
                    deleteMany: {},
                    create: tutorials.map(t => ({
                        title: t.title,
                        videoUrl: t.url
                    }))
                }
            }
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
