const nodemailer = require('nodemailer');
const prisma = require('./prisma');

// Create a transporter using environment variables
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Validates if the transporter has valid credentials configured.
 * It's useful to prevent crashing if the user hasn't set up the .env file yet.
 */
const isMailConfigured = () => {
    return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
};

/**
 * Sends an email notification to all Admin users.
 * @param {string} subject - The subject of the email.
 * @param {string} text - The body of the email.
 */
const sendAdminNotification = async (subject, text) => {
    if (!isMailConfigured()) {
        console.warn('[MailService] Email not sent because SMTP credentials are not configured in .env.');
        return;
    }

    try {
        // Fetch all admin emails from the database
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { email: true }
        });

        const adminEmails = admins.map(admin => admin.email);

        if (adminEmails.length === 0) {
            console.warn('[MailService] No admin users found to send email to.');
            return;
        }

        // Setup email data
        const mailOptions = {
            from: `"G.U.I.D.E. System" <${process.env.SMTP_USER}>`,
            to: adminEmails.join(', '), // Send to all admins
            subject: `[Admin Alert] ${subject}`,
            text: text,
            html: `<p>${text.replace(/\n/g, '<br>')}</p>`,
        };

        // Send mail
        const info = await transporter.sendMail(mailOptions);
        console.log(`[MailService] Notification sent to admins: ${info.messageId}`);
    } catch (error) {
        console.error('[MailService Error] Failed to send email to admins:', error);
    }
};

module.exports = {
    sendAdminNotification
};
