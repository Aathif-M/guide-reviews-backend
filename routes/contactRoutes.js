/**
 * Contact Routes
 * Defines the Express API endpoints related to platform inquiries.
 */
const express = require('express');
const { submitContactForm } = require('../controllers/contactController');

const router = express.Router();

// Route: POST /api/v1/contact
// Purpose: Receives contact form payload and triggers admin email.
router.post('/contact', submitContactForm);

module.exports = router;
