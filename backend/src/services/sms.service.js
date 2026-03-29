const https = require('https');

async function sendSMS(to, message) {
  try {
    const payload = JSON.stringify({
      source_addr: process.env.BEEM_SENDER_ID || 'INFO',
      encoding: 0,
      message: message,
      recipients: [{ recipient_id: 1, dest_addr: to }],
    });

    const credentials = Buffer.from(
      `${process.env.BEEM_API_KEY}:${process.env.BEEM_SECRET_KEY}`
    ).toString('base64');

    const options = {
      hostname: 'apisms.beem.africa',
      port: 443,
      path: '/v1/send',
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          console.log('[SMS BEEM]', data);
          resolve(data);
        });
      });
      req.on('error', (err) => {
        console.error('[SMS BEEM ERROR]', err);
        reject(err);
      });
      req.write(payload);
      req.end();
    });
  } catch (err) {
    console.error('[SMS ERROR]', err);
  }
}

module.exports = { sendSMS };
