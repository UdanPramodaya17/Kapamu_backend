const nodemailer = require('nodemailer');

const getTransporter = () => {
  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || process.env.SMTP_PASS || '').replace(/\s+/g, '');

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

const sendEmail = async (options) => {
  try {
    const transporter = getTransporter();
    const fromUser = (process.env.EMAIL_USER || process.env.SMTP_USER || 'noreply@kapamu.com').trim();

    const mailOptions = {
      from: `KAPAMU <${fromUser}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${options.email}`);
  } catch (error) {
    console.error('Error sending email:', error.message || error);
    throw error;
  }
};

module.exports = {
  getTransporter,
  sendEmail,
};

