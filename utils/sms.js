const sendSMS = async (to, message) => {
  const provider = process.env.SMS_PROVIDER || 'mock';
  
  // Format phone number to international format if needed (e.g., 0771234567 -> +94771234567)
  let formattedNumber = to ? to.trim() : '';
  if (!formattedNumber) {
    console.warn('[SMS Notification] Recipient phone number is empty.');
    return;
  }

  if (formattedNumber.startsWith('0') && formattedNumber.length === 10) {
    formattedNumber = '+94' + formattedNumber.substring(1);
  }

  console.log(`[SMS Notification Queue] Sending to ${formattedNumber} via ${provider}...`);

  try {
    if (provider === 'twilio') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      
      if (!accountSid || !authToken || !fromNumber) {
        console.warn('Twilio configuration is missing. Logging to console instead.');
        console.log(`[MOCK SMS to ${formattedNumber}]: ${message}`);
        return;
      }
      
      try {
        const twilio = require('twilio');
        const client = twilio(accountSid, authToken);
        await client.messages.create({
          body: message,
          from: fromNumber,
          to: formattedNumber
        });
        console.log(`SMS successfully sent via Twilio to ${formattedNumber}`);
      } catch (err) {
        console.error('Failed to send via Twilio. Ensure "twilio" dependency is installed.');
        console.error(err);
        console.log(`[MOCK SMS to ${formattedNumber}]: ${message}`);
      }
      
    } else if (provider === 'notifylk') {
      const apiKey = process.env.NOTIFY_API_KEY;
      const userId = process.env.NOTIFY_USER_ID;
      const senderId = process.env.SMS_SENDER_ID || 'NotifyDemo';
      
      if (!apiKey || !userId) {
        console.warn('Notify.lk configuration is missing. Logging to console instead.');
        console.log(`[MOCK SMS to ${formattedNumber}]: ${message}`);
        return;
      }

      // Convert +94 to 94 format for Notify.lk
      let cleanNum = formattedNumber;
      if (cleanNum.startsWith('+')) {
        cleanNum = cleanNum.substring(1);
      }

      const url = `https://app.notify.lk/api/v1/send?api_key=${apiKey}&user_id=${userId}&sender_id=${senderId}&to=${cleanNum}&message=${encodeURIComponent(message)}`;
      
      const response = await fetch(url, { method: 'POST' });
      const result = await response.json();
      
      if (result && (result.status === 'success' || result.code === 200)) {
        console.log(`SMS successfully sent via Notify.lk to ${formattedNumber}`);
      } else {
        console.error('Notify.lk API Error:', result);
      }
      
    } else {
      // Mock/Console log fallback
      console.log(`[MOCK SMS to ${formattedNumber}]: ${message}`);
    }
  } catch (error) {
    console.error('Error in sending SMS:', error.message);
  }
};

module.exports = { sendSMS };
