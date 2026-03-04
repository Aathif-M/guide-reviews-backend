require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const appRoutes = require('./routes/appRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const forumRoutes = require('./routes/forumRoutes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/apps', appRoutes);
app.use('/api/v1', reviewRoutes); // Note: handles /apps/:id/reviews and /reviews/:id
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1', forumRoutes); // Note: handles /apps/:id/forums and /forums/*

const { startCleanupJobs } = require('./utils/cronJobs');

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
    res.send('G.U.I.D.E. API is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startCleanupJobs();
});
