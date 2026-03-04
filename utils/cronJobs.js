const prisma = require('./prisma');

/**
 * Cleanup job that runs periodically to delete users who have been
 * suspended for more than 30 days.
 */
const startCleanupJobs = () => {
    console.log('Starting background cleanup jobs...');

    // Check every 24 hours (86400000 ms)
    setInterval(async () => {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const result = await prisma.user.deleteMany({
                where: {
                    isSuspended: true,
                    suspendedAt: {
                        lte: thirtyDaysAgo
                    }
                }
            });

            if (result.count > 0) {
                console.log(`[Cleanup] Deleted ${result.count} suspended accounts older than 30 days.`);
            }
        } catch (error) {
            console.error('[Cleanup Error] Failed to run suspension cleanup job:', error);
        }
    }, 24 * 60 * 60 * 1000); // 24 hours
};

module.exports = { startCleanupJobs };
