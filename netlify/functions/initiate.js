const crypto = require('crypto');

exports.handler = async function (event, context) {
    // Handling CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Verify, X-Merchant-Id',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { amount, mobileNumber, userId } = JSON.parse(event.body);

        if (!amount || !userId || !mobileNumber) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: amount, userId, or mobileNumber' })
            };
        }

        const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
        const SALT_KEY = process.env.PHONEPE_SALT_KEY;
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;
        const IS_PROD = process.env.PHONEPE_ENV === 'production';

        if (!MERCHANT_ID || !SALT_KEY) {
            console.error("Missing PhonePe Credentials");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Server misconfiguration: Missing PhonePe Credentials" })
            };
        }

        // Determine URL (Sandbox for simulator fallback or real)
        const PHONEPE_API_URL = IS_PROD
            ? 'https://api.phonepe.com/apis/hermes/pg/v1/pay'
            : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

        // Base URL for callbacks (Netlify URL)
        // process.env.URL is provided by Netlify
        const HOST_URL = process.env.URL || 'http://localhost:8888';

        const transactionId = `TXN_${userId.substring(0, 6)}_${Date.now()}`;

        const payload = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: transactionId,
            merchantUserId: userId,
            amount: amount * 100,
            redirectUrl: `${HOST_URL}/payment-status`,
            redirectMode: "POST",
            callbackUrl: `${HOST_URL}/.netlify/functions/webhook`,
            mobileNumber: mobileNumber,
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
        const stringToSign = base64Payload + "/pg/v1/pay" + SALT_KEY;
        const checksum = crypto.createHash('sha256').update(stringToSign).digest('hex') + "###" + SALT_INDEX;

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
            },
            body: JSON.stringify({ request: base64Payload })
        };

        console.log(`Initiating Payment to: ${PHONEPE_API_URL}`);

        // Note: Using built-in fetch (Node 18+)
        const response = await fetch(PHONEPE_API_URL, options);
        const data = await response.json();

        if (data.success) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    url: data.data.instrumentResponse.redirectInfo.url,
                    transactionId: transactionId
                })
            };
        } else {
            console.error("PhonePe Gateway Error:", JSON.stringify(data, null, 2));
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: data.message || "Payment initiation failed at gateway",
                    details: data
                })
            };
        }

    } catch (error) {
        console.error("Internal Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Internal Server Error", details: error.message })
        };
    }
};
