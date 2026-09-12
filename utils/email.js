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
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });
};

const sendEmail = async (options) => {
  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const senderEmail = (process.env.EMAIL_USER || process.env.SMTP_USER || 'noreply@kapamu.com').trim();

  // 1. Brevo HTTPS API (Best for sending to ANY email address without domain verification - 300 free/day)
  if (brevoApiKey) {
    try {
      console.log(`[Email] Sending to ${options.email} via Brevo HTTPS API...`);
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'KAPAMU', email: senderEmail },
          to: [{ email: options.email }],
          subject: options.subject,
          htmlContent: options.html,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || `Brevo Error (${response.status})`);
      }

      console.log(`[Email] Successfully sent to ${options.email} via Brevo (MessageId: ${resData.messageId})`);
      return resData;
    } catch (brevoError) {
      console.error('[Email Brevo Error]:', brevoError.message);
      // Fall through to other providers if Brevo fails
    }
  }

  // 2. Resend HTTPS API (Works over Port 443)
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
    }
  }

  // 3. Fallback: SMTP via Gmail (Works on localhost)
  try {
    console.log(`[Email] Sending to ${options.email} via Gmail SMTP...`);
    const transporter = getTransporter();

    const mailOptions = {
      from: `KAPAMU <${senderEmail}>`,
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




