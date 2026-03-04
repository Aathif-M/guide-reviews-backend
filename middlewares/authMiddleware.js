const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token provided, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify user still exists and is not suspended
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) {
            return res.status(401).json({ error: 'User does not exist' });
        }
        if (user.isSuspended) {
            return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

module.exports = authMiddleware;
