const crypto = require('crypto');

/**
 * Fetches the OAuth Access Token from PhonePe
 */
async function getAccessToken(clientId, clientSecret, clientVersion, isProd) {
    const tokenUrl = isProd
        ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${auth}`
            },
            body: new URLSearchParams({ grant_type: 'client_credentials' })
        });

        const data = await response.json();

        if (data.access_token) {
            return data.access_token;
        } else {
            throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        console.error("Token Fetch Error:", error);
        throw error;
    }
}

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

        // V2 Credentials
        const CLIENT_ID = process.env.PHONEPE_CLIENT_ID;
        const CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET;
        const CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || 1;

        // V1 Credentials
        const SALT_KEY = process.env.PHONEPE_SALT_KEY;
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;

        const IS_PROD = process.env.PHONEPE_ENV === 'production';

        if (!MERCHANT_ID || (!SALT_KEY && !CLIENT_ID)) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing PhonePe Credentials" }) };
        }

        const PHONEPE_STATUS_URL = IS_PROD
            ? `https://api.phonepe.com/apis/hermes/pg/v1/status/${MERCHANT_ID}/${transactionId}`
            : `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${MERCHANT_ID}/${transactionId}`;

        let apiHeaders = {
            'Content-Type': 'application/json',
            'X-MERCHANT-ID': MERCHANT_ID
        };

        if (CLIENT_ID && CLIENT_SECRET) {
            // === V2 FLOW ===
            const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, CLIENT_VERSION, IS_PROD);
            apiHeaders['Authorization'] = `Bearer ${accessToken}`;
        } else {
            // === V1 FLOW ===
            const stringToSign = `/pg/v1/status/${MERCHANT_ID}/${transactionId}` + SALT_KEY;
            const checksum = crypto.createHash('sha256').update(stringToSign).digest('hex') + "###" + SALT_INDEX;
            apiHeaders['X-VERIFY'] = checksum;
        }

        const response = await fetch(PHONEPE_STATUS_URL, {
            method: 'GET',
            headers: apiHeaders
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
                statusCode: 200,
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
