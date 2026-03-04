/**
 * Contact Controller
 * Handles the submission of the "Get In Touch" form from the frontend.
 * Validates the input and forwards the message to the admin team via the mail service.
 */
const { sendAdminNotification } = require('../utils/mailService');

/**
 * Express middleware to process contact form POST requests.
 * @param {Object} req - Express request object containing fullName, email, and message.
 * @param {Object} res - Express response object used to send success/error states.
 */
const submitContactForm = async (req, res) => {
    try {
        // 1. Destructure the expected payload from the frontend request
        const { fullName, email, message } = req.body;

        // 2. Perform basic validation to ensure no empty submissions
        if (!fullName || !email || !message) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const subject = `New Contact Inquiry from ${fullName}`;
        const body = `You have received a new contact inquiry:

Name: ${fullName}
Email: ${email}

Message:
${message}
`;

        await sendAdminNotification(subject, body);

        res.status(200).json({ message: 'Contact message sent successfully.' });
    } catch (error) {
        console.error('Error submitting contact form:', error);
        res.status(500).json({ error: 'Failed to send message. Please try again later.' });
    }
};

module.exports = {
    submitContactForm
};
