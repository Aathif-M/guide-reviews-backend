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
            html: `<!DOCTYPE html>
                    <html>
                    <head>
                    <style>
                        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #334155; line-height: 1.6; }
                        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
                        .header { background: linear-gradient(135deg, #0ea5e9, #3b82f6); padding: 30px 40px; text-align: left; }
                        .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
                        .header p { margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 15px; font-weight: 500; }
                        .content { padding: 40px; }
                        .message-box { background-color: #f1f5f9; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 30px; }
                        .message-text { color: #1e293b; font-size: 16px; white-space: pre-line; margin: 0; }
                        .footer { background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
                        .footer p { color: #64748b; font-size: 14px; margin: 0; }
                        .btn { display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 10px; }
                    </style>
                    </head>
                    <body>
                    <div class="container">
                        <div class="header">
                        <h1>G.U.I.D.E. Admin Notification</h1>
                        <p>${subject}</p>
                        </div>
                        
                        <div class="content">
                        <div class="message-box">
                            <p class="message-text">${text.replace(/\n/g, '<br>')}</p>
                        </div>
                        
                        <p style="color: #475569; font-size: 15px; margin-top: 30px;">
                            Please log in to the admin dashboard to review this item and take any necessary actions.
                        </p>
                        
                        <div style="text-align: center; margin-top: 25px;">
                            <a href="http://localhost:5173/admin" class="btn">View Admin Dashboard</a>
                        </div>
                        </div>
                        
                        <div class="footer">
                        <p>This is an automated message from the Generational Usability Index for Digital Engagement (G.U.I.D.E.) platform.</p>
                        </div>
                    </div>
                    </body>
                    </html>`,
        };

        // Send mail
        const info = await transporter.sendMail(mailOptions);
        console.log(`[MailService] Notification sent to admins: ${info.messageId} `);
    } catch (error) {
        console.error('[MailService Error] Failed to send email to admins:', error);
    }
};

/**
 * Sends an email notification to a specific user.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} text - The body of the email.
 */
const sendUserNotification = async (toEmail, subject, text) => {
    if (!isMailConfigured()) {
        console.warn(`[MailService] Email not sent to ${toEmail} because SMTP credentials are not configured in .env.`);
        return;
    }

    try {
        const mailOptions = {
            from: `"G.U.I.D.E. System" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `[G.U.I.D.E. Update] ${subject}`,
            text: text,
            html: `<!DOCTYPE html>
                    <html>
                    <head>
                    <style>
                        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #334155; line-height: 1.6; }
                        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
                        .header { background: linear-gradient(135deg, #0ea5e9, #8b5cf6); padding: 30px 40px; text-align: left; }
                        .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
                        .header p { margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 15px; font-weight: 500; }
                        .content { padding: 40px; }
                        .message-box { background-color: #f1f5f9; border-left: 4px solid #8b5cf6; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 30px; }
                        .message-text { color: #1e293b; font-size: 16px; white-space: pre-line; margin: 0; }
                        .footer { background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
                        .footer p { color: #64748b; font-size: 14px; margin: 0; }
                        .btn { display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 10px; }
                    </style>
                    </head>
                    <body>
                    <div class="container">
                        <div class="header">
                        <h1>G.U.I.D.E. Platform</h1>
                        <p>${subject}</p>
                        </div>
                        
                        <div class="content">
                        <div class="message-box">
                            <p class="message-text">${text.replace(/\n/g, '<br>')}</p>
                        </div>
                        
                        <p style="color: #475569; font-size: 15px; margin-top: 30px;">
                            Thanks for being an active part of the G.U.I.D.E. community!
                        </p>
                        
                        <div style="text-align: center; margin-top: 25px;">
                            <a href="http://localhost:5173" class="btn">Return to Platform</a>
                        </div>
                        </div>
                        
                        <div class="footer">
                        <p>This is an automated message from the Generational Usability Index for Digital Engagement (G.U.I.D.E.) platform.</p>
                        </div>
                    </div>
                    </body>
                    </html>`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[MailService] Notification sent to user ${toEmail}: ${info.messageId}`);
    } catch (error) {
        console.error(`[MailService Error] Failed to send email to user ${toEmail}:`, error);
    }
};

module.exports = {
    sendAdminNotification,
    sendUserNotification
};
