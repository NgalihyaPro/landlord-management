const AfricasTalking = require('africastalking');

const hasAtCredentials = Boolean(process.env.AT_USERNAME && process.env.AT_API_KEY);
const at = hasAtCredentials
  ? AfricasTalking({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
  })
  : null;

const sms = at ? at.SMS : null;

async function sendSMS(to, message) {
  if (!sms) {
    console.warn('[SMS AT] Skipped: AT_USERNAME or AT_API_KEY is missing.');
    return {
      success: false,
      skipped: true,
      reason: 'Africa\'s Talking credentials are missing',
    };
  }

  try {
    const result = await sms.send({
      to: [to],
      message,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log('[SMS AT]', JSON.stringify(result));
    return result;
  } catch (err) {
    console.error('[SMS AT ERROR]', err);
  }
}

module.exports = { sendSMS, smsClient: sms };
