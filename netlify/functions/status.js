const crypto = require('crypto');

exports.handler = async function (event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Verify, X-Merchant-Id',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const { transactionId } = event.queryStringParameters || {};

    if (!transactionId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Transaction ID is required" }) };
    }

    try {
        const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
        const SALT_KEY = process.env.PHONEPE_SALT_KEY;
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;
        const IS_PROD = process.env.PHONEPE_ENV === 'production';

        if (!MERCHANT_ID || !SALT_KEY) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing PhonePe Credentials" }) };
        }

        const PHONEPE_STATUS_URL = IS_PROD
            ? `https://api.phonepe.com/apis/hermes/pg/v1/status/${MERCHANT_ID}/${transactionId}`
            : `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${MERCHANT_ID}/${transactionId}`;

        const stringToSign = `/pg/v1/status/${MERCHANT_ID}/${transactionId}` + SALT_KEY;
        const checksum = crypto.createHash('sha256').update(stringToSign).digest('hex') + "###" + SALT_INDEX;

        const response = await fetch(PHONEPE_STATUS_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': MERCHANT_ID
            }
        });

        const data = await response.json();

        if (data.success) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    status: data.code === 'PAYMENT_SUCCESS' ? 'SUCCESS' :
                        data.code === 'PAYMENT_PENDING' ? 'PENDING' : 'FAILED',
                    original_data: data
                })
            };
        } else {
            return {
                statusCode: 200, // Return 200 even on API failure to handle gracefully in frontend
                headers,
                body: JSON.stringify({
                    success: false,
                    status: 'FAILED',
                    message: data.message
                })
            };
        }

    } catch (error) {
        console.error("Status Check Error:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: "Internal Server Error" }) };
    }
};
