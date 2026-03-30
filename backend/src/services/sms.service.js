const AfricasTalking = require('africastalking');

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

const sms = at.SMS;

async function sendSMS(to, message) {
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

module.exports = { sendSMS };
