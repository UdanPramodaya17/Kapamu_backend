const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  try {
    // 1. Create a transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || process.env.SMTP_USER,
        pass: process.env.EMAIL_PASS || process.env.SMTP_PASS,
      },
    });

    // 2. Define the email options
    const mailOptions = {
      from: `KAPAMU <${process.env.EMAIL_USER || process.env.SMTP_USER || 'noreply@kapamu.com'}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
    };

    // 3. Actually send the email
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${options.email}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

module.exports = {
  sendEmail,
};
