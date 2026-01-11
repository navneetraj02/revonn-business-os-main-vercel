const crypto = require('crypto');

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        // PhonePe sends x-verify header (case-insensitive)
        const xVerify = event.headers['x-verify'] || event.headers['X-VERIFY'];
        const bodyObj = JSON.parse(event.body);
        const responseBase64 = bodyObj.response;

        if (!responseBase64 || !xVerify) {
            return { statusCode: 400, body: JSON.stringify({ error: "Invalid Webhook Payload" }) };
        }

        const SALT_KEY = process.env.PHONEPE_SALT_KEY;
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;

        if (!SALT_KEY) {
            console.error("Missing Salt Key");
            return { statusCode: 500, body: JSON.stringify({ error: "Server Configuration Error" }) };
        }

        const stringToSign = responseBase64 + SALT_KEY;
        const calculatedChecksum = crypto.createHash('sha256').update(stringToSign).digest('hex') + "###" + SALT_INDEX;

        if (calculatedChecksum !== xVerify) {
            console.error("Webhook Checksum Mismatch!");
            return { statusCode: 403, body: JSON.stringify({ error: "Checksum verification failed" }) };
        }

        const decodedPayload = JSON.parse(Buffer.from(responseBase64, 'base64').toString('utf-8'));
        console.log("Received Valid Webhook:", JSON.stringify(decodedPayload, null, 2));

        return { statusCode: 200, body: JSON.stringify({ status: "success" }) };

    } catch (error) {
        console.error("Webhook Error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
    }
};
