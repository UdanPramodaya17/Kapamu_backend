/**
 * KAPAMU Luxury Editorial Email Templates
 * Standardized responsive HTML email generator matching Kapamu's monochrome luxury aesthetic.
 */

const baseEmailLayout = ({ title, subtitle, content, callToAction, footerNote }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'KAPAMU Notification'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body {
      margin: 0;
      padding: 0;
      background-color: #f8f9fa;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
    }
  </style>
</head>
<body style="margin: 0; padding: 30px 15px; background-color: #f4f4f5; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e4e4e7; box-shadow: 0 10px 30px rgba(0,0,0,0.04);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #09090b; padding: 36px 40px; text-align: center;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <span style="display: inline-block; font-size: 24px; font-weight: 900; letter-spacing: 0.22em; color: #ffffff; text-transform: uppercase; font-family: 'Plus Jakarta Sans', sans-serif;">
                      KAPAMU
                    </span>
                    <div style="height: 2px; width: 32px; background-color: #ffffff; margin: 10px auto 0; opacity: 0.3;"></div>
                    <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 600;">
                      Premier Salon & Grooming Platform
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 40px 32px;">
              ${subtitle ? `<div style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a; margin-bottom: 8px;">${subtitle}</div>` : ''}
              
              <h1 style="margin: 0 0 20px; font-size: 22px; font-weight: 800; color: #09090b; letter-spacing: -0.02em; line-height: 1.3;">
                ${title}
              </h1>

              <div style="font-size: 14.5px; line-height: 1.7; color: #3f3f46;">
                ${content}
              </div>

              ${callToAction ? `
                <div style="text-align: center; margin: 36px 0 24px;">
                  <a href="${callToAction.url}" style="display: inline-block; background-color: #09090b; color: #ffffff; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; padding: 15px 36px; border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
                    ${callToAction.label} &rarr;
                  </a>
                </div>
              ` : ''}

              ${footerNote ? `
                <div style="margin-top: 28px; padding-top: 20px; border-top: 1px dashed #e4e4e7; font-size: 12px; line-height: 1.6; color: #a1a1aa;">
                  ${footerNote}
                </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #f4f4f5; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 11.5px; color: #71717a; font-weight: 500;">
                &copy; ${new Date().getFullYear()} KAPAMU. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 10.5px; color: #a1a1aa;">
                Automated notification from KAPAMU. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// 1. Verification OTP Email
const getVerificationOtpEmail = (otp) => {
  const content = `
    <p>Thank you for signing up with <strong>KAPAMU</strong>. Please use the one-time security verification code below to verify your email address:</p>
    
    <div style="background-color: #fafafa; border: 2px dashed #09090b; border-radius: 16px; padding: 24px; text-align: center; margin: 28px 0;">
      <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #71717a; display: block; margin-bottom: 8px;">Your 6-Digit Code</span>
      <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 0.28em; color: #09090b; padding-left: 0.28em; display: inline-block;">${otp}</span>
    </div>

    <p style="margin: 0; font-size: 13.5px; color: #71717a;">
      This code is valid for <strong>10 minutes</strong>. For your security, never share this code with anyone.
    </p>
  `;

  return baseEmailLayout({
    title: 'Verify Your Email Address',
    subtitle: 'Security Verification',
    content,
    footerNote: 'If you did not initiate this request, you can safely ignore this email.',
  });
};

// 2. Saloon Admin Setup Password Email
const getSaloonSetupPasswordEmail = (setupLink, saloonName = 'your Saloon') => {
  const content = `
    <p>Welcome to <strong>KAPAMU</strong>! Your Saloon administrative account for <strong>${saloonName}</strong> has been created.</p>
    <p>To access your manager portal and manage appointments, barbers, services, and earnings, please click the button below to set up your secure password.</p>
  `;

  return baseEmailLayout({
    title: 'Set Up Your Saloon Admin Account',
    subtitle: 'Saloon Partner Onboarding',
    content,
    callToAction: {
      url: setupLink,
      label: 'Set Up Password',
    },
    footerNote: 'This onboarding setup link expires in 24 hours. For technical assistance, reach out to KAPAMU Partner Support.',
  });
};

// 3. Seller Setup Password Email
const getSellerSetupPasswordEmail = (setupLink, name, storeName) => {
  const content = `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your official Seller account for <strong>${storeName}</strong> is now ready on <strong>KAPAMU Marketplace</strong>.</p>
    <p>You can now list grooming products, manage customer orders, track payouts, and grow your brand on Sri Lanka's leading grooming network.</p>
  `;

  return baseEmailLayout({
    title: 'Welcome to KAPAMU Marketplace',
    subtitle: 'Vendor Partner Access',
    content,
    callToAction: {
      url: setupLink,
      label: 'Set Up Store Password',
    },
    footerNote: 'This secure link is active for 48 hours. If you did not apply for a seller account, please contact our support team.',
  });
};

// 4. Password Reset Email
const getPasswordResetEmail = (resetLink) => {
  const content = `
    <p>We received a request to reset the password for your <strong>KAPAMU</strong> account.</p>
    <p>Click the button below to choose a new, secure password for your account:</p>
  `;

  return baseEmailLayout({
    title: 'Reset Your Password',
    subtitle: 'Account Security',
    content,
    callToAction: {
      url: resetLink,
      label: 'Reset Password',
    },
    footerNote: 'This password reset link expires in 1 hour. If you did not request a password reset, your account is safe and no action is required.',
  });
};

// 5. Appointment Confirmed Email
const getAppointmentConfirmedEmail = ({ customerName, saloonName, serviceName, date, time, barberName, totalAmount }) => {
  const content = `
    <p>Hi <strong>${customerName}</strong>,</p>
    <p>Great news! Your booking at <strong>${saloonName}</strong> has been officially confirmed.</p>

    <!-- Booking Summary Card -->
    <div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 16px; padding: 22px; margin: 24px 0;">
      <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a; margin-bottom: 14px; border-bottom: 1px solid #e4e4e7; padding-bottom: 8px;">
        Appointment Summary
      </div>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 13.5px;">
        <tr>
          <td style="color: #71717a; width: 35%;">Saloon:</td>
          <td style="color: #09090b; font-weight: 700;">${saloonName}</td>
        </tr>
        <tr>
          <td style="color: #71717a;">Service:</td>
          <td style="color: #09090b; font-weight: 700;">${serviceName}</td>
        </tr>
        ${barberName ? `
        <tr>
          <td style="color: #71717a;">Stylist:</td>
          <td style="color: #09090b; font-weight: 700;">${barberName}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="color: #71717a;">Date & Time:</td>
          <td style="color: #09090b; font-weight: 700;">${date} at ${time}</td>
        </tr>
        ${totalAmount ? `
        <tr>
          <td style="color: #71717a;">Total:</td>
          <td style="color: #09090b; font-weight: 800; font-size: 15px;">LKR ${Number(totalAmount).toLocaleString()}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <p style="margin: 0; font-size: 13.5px; color: #71717a;">
      Please arrive 5–10 minutes before your scheduled appointment time.
    </p>
  `;

  return baseEmailLayout({
    title: 'Booking Confirmed!',
    subtitle: 'Appointment Schedule',
    content,
    footerNote: 'Need to reschedule or cancel? Log in to your KAPAMU client dashboard.',
  });
};

module.exports = {
  baseEmailLayout,
  getVerificationOtpEmail,
  getSaloonSetupPasswordEmail,
  getSellerSetupPasswordEmail,
  getPasswordResetEmail,
  getAppointmentConfirmedEmail,
};
