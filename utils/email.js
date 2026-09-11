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
    connectionTimeout: 5000, // 5s timeout to prevent hanging on cloud hosts
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });
};

const sendEmail = async (options) => {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  // 1. If RESEND_API_KEY is available, send via Resend HTTPS API (Port 443 - Never blocked on Render)
  if (resendApiKey) {
    try {
      console.log(`[Email] Sending to ${options.email} via Resend HTTPS API...`);
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'KAPAMU <onboarding@resend.dev>';

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [options.email],
          subject: options.subject,
          html: options.html,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || resData.name || `Resend API Error (${response.status})`);
      }

      console.log(`[Email] Successfully sent to ${options.email} via Resend (ID: ${resData.id})`);
      return resData;
    } catch (resendError) {
      console.error('[Email Resend Error]:', resendError.message);
      throw resendError;
    }
  }

  // 2. Fallback: SMTP via Gmail (Works in localhost, blocked on Render free tier)
  try {
    console.log(`[Email] Sending to ${options.email} via Gmail SMTP...`);
    const transporter = getTransporter();
    const fromUser = (process.env.EMAIL_USER || process.env.SMTP_USER || 'noreply@kapamu.com').trim();

    const mailOptions = {
      from: `KAPAMU <${fromUser}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Successfully sent to ${options.email} via SMTP`);
    return info;
  } catch (error) {
    console.error('[Email SMTP Error]:', error.message || error);
    throw error;
  }
};

module.exports = {
  getTransporter,
  sendEmail,
};



