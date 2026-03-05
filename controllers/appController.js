const prisma = require('../utils/prisma');
const { sendAdminNotification, sendUserNotification } = require('../utils/mailService');

/**
 * Fetch all applications.
 * Normal users receive only 'APPROVED' apps. Admins receive all apps regardless of status.
 * Filtering by category ID and searching by title are supported via query strings.
 * Ratings are aggregated by combining traditional stars and heuristic questionnaire results.
 */
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
                tutorials: {
                    where: (!req.user || req.user.role !== 'ADMIN') ? { approvalStatus: 'APPROVED' } : undefined
                },
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
                computedRating: Number(aggregatedRating.toFixed(2))
            };
        });

        res.json(appsResponse);
    } catch (err) {
        res.status(500).json({ error: 'Server error parsing apps' });
    }
};

/**
 * Fetch detailed view for a single application by its ID.
 * Returns attached tutorials, related category heuristic questions, and a filtered list of reviews.
 * Unauthorized users are blocked from viewing unapproved applications.
 */
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
                        questionAnswers: {
                            include: {
                                question: { select: { question: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!app) return res.status(404).json({ error: 'App not found' });

        // Non-admins shouldn't see unapproved apps
        if (app.approvalStatus !== 'APPROVED' && (!req.user || req.user.role !== 'ADMIN')) {
            return res.status(403).json({ error: 'Access denied: App not approved yet' });
        }

        // In memory tutorial filtering
        if (app.tutorials) {
            app.tutorials = app.tutorials.filter(t => t.approvalStatus === 'APPROVED');
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
            computedRating: Number(aggregatedRating.toFixed(2))
        };

        res.json(appResponse);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching app details' });
    }
};

/**
 * Authenticated users or admins can submit a new application for review.
 * Normal user submissions enter a 'PENDING' state requiring admin approval.
 * Admin submissions are automatically 'APPROVED'.
 * Supported fields include title, logo (via file upload), descriptions, app store links, and tutorials.
 */
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

        const approvalStatus = req.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING';
        const newApp = await prisma.app.create({
            data: {
                title,
                description,
                logoUrl,
                playstoreLink,
                appstoreLink,
                categoryId,
                submitterId: req.user.id,
                approvalStatus,
                approverId: req.user.role === 'ADMIN' ? req.user.id : null,
                tutorials: {
                    create: tutorials.map(t => ({
                        title: t.title,
                        videoUrl: t.url,
                        approvalStatus
                    }))
                }
            }
        });

        if (approvalStatus === 'PENDING') {
            sendAdminNotification(
                'New App Submission Requires Approval',
                `A new application "${title}" has been submitted and is waiting for admin approval.\n\nDescription:\n${description}\n\nPlease check the Admin Dashboard.`
            );
        }

        res.status(201).json(newApp);
    } catch (err) {
        res.status(500).json({ error: 'Server error submitting app' });
    }
};

// Edit an app (Admin)
const updateApp = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, playstoreLink, appstoreLink, categoryId } = req.body;

        // Handle logo: use newly uploaded file if provided, otherwise keep the existing logoUrl from the body
        let logoUrl = req.body.logoUrl;
        if (req.file) {
            logoUrl = `/uploads/${req.file.filename}`;
        }

        // Tutorials may come as a JSON-encoded string (FormData) or as an already-parsed array
        let tutorials = req.body.tutorials || [];
        if (typeof tutorials === 'string') {
            try { tutorials = JSON.parse(tutorials); } catch (e) { tutorials = []; }
        }

        const keepIds = tutorials.filter(t => t.id).map(t => t.id);

        if (keepIds.length > 0) {
            await prisma.appTutorial.deleteMany({
                where: {
                    appId: id,
                    id: { notIn: keepIds }
                }
            });
        } else {
            // If no keepIds, that means all existing tutorials were removed by the admin
            await prisma.appTutorial.deleteMany({
                where: { appId: id }
            });
        }

        for (const t of tutorials) {
            if (t.id) {
                await prisma.appTutorial.update({
                    where: { id: t.id },
                    data: {
                        title: t.title,
                        videoUrl: t.url,
                        approvalStatus: 'APPROVED'
                    }
                });
            } else {
                await prisma.appTutorial.create({
                    data: {
                        appId: id,
                        title: t.title,
                        videoUrl: t.url,
                        submitterId: req.user.id,
                        approvalStatus: 'APPROVED'
                    }
                });
            }
        }

        const app = await prisma.app.update({
            where: { id },
            data: {
                title,
                description,
                logoUrl,
                playstoreLink,
                appstoreLink,
                categoryId
            },
            include: {
                tutorials: true
            }
        });

        res.json(app);
    } catch (err) {
        console.error("Update App Error:", err);
        res.status(500).json({ error: 'Server error updating app' });
    }
};

const submitTutorial = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, url } = req.body;

        const approvalStatus = req.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING';
        const tutorial = await prisma.appTutorial.create({
            data: {
                title,
                videoUrl: url,
                appId: id,
                submitterId: req.user.id,
                approvalStatus
            }
        });

        if (approvalStatus === 'PENDING') {
            const app = await prisma.app.findUnique({ where: { id } });
            sendAdminNotification(
                'New App Tutorial Requires Approval',
                `A new tutorial "${title}" has been submitted for the app "${app ? app.title : 'Unknown'}" and is waiting for admin approval.\n\nLink: ${url}\n\nPlease check the Admin Dashboard.`
            );
        }

        res.status(201).json(tutorial);
    } catch (err) {
        res.status(500).json({ error: 'Server error submitting tutorial' });
    }
};

const approveTutorial = async (req, res) => {
    try {
        const { tutorialId } = req.params;
        const { status } = req.body; // 'APPROVED' or 'REJECTED'

        const tutorial = await prisma.appTutorial.update({
            where: { id: tutorialId },
            data: { approvalStatus: status },
            include: { app: { select: { title: true } }, submitter: { select: { email: true, firstName: true } } }
        });

        if (status === 'APPROVED' && tutorial.submitter?.email) {
            sendUserNotification(
                tutorial.submitter.email,
                `Your Tutorial for ${tutorial.app?.title} has been Approved!`,
                `Hi ${tutorial.submitter.firstName || 'there'},\n\nGreat news! Your video tutorial "${tutorial.title}" for the app "${tutorial.app?.title}" has been reviewed and approved by our moderation team.\n\nIt is now live on the G.U.I.D.E. platform and helping our community.`
            );
        }

        res.json(tutorial);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating tutorial status' });
    }
};

const deleteTutorial = async (req, res) => {
    try {
        const { tutorialId } = req.params;
        await prisma.appTutorial.delete({ where: { id: tutorialId } });
        res.json({ message: 'Tutorial deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error deleting tutorial' });
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
            },
            include: { submitter: { select: { email: true, firstName: true } } }
        });

        if (status === 'APPROVED' && app.submitter?.email) {
            sendUserNotification(
                app.submitter.email,
                `Your App Submission "${app.title}" has been Approved!`,
                `Hi ${app.submitter.firstName || 'there'},\n\nGreat news! The application you submitted, "${app.title}", has successfully passed our heuristic review process and is now live on the G.U.I.D.E. platform.\n\nThank you for contributing to an accessible digital world for everyone.`
            );
        }

        res.json(app);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating app status' });
    }
};

module.exports = {
    getApps, getAppById, submitApp, updateApp, deleteApp, approveApp, submitTutorial, approveTutorial, deleteTutorial
};
