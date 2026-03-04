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
            html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:30px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
    <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:0.5px;">G.U.I.D.E. Admin Alert</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${subject}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#cbd5e1;font-size:15px;line-height:1.7;white-space:pre-line;">${text}</p>
    </div>
    <div style="padding:16px 32px 28px;">
      <p style="color:#64748b;font-size:13px;margin:0;">This is an automated notification from G.U.I.D.E. Please log in to the Admin Dashboard to review and take action.</p>
    </div>
  </div>
</body>
</html>`,
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
