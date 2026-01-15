const crypto = require('crypto');

/**
 * Fetches the OAuth Access Token from PhonePe
 */
async function getAccessToken(clientId, clientSecret, clientVersion, isProd) {
    const tokenUrl = isProd
        ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

    console.log(`Fetching Access Token from: ${tokenUrl}`);

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

        // Credentials
        const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;

        // V2 Credentials
        const CLIENT_ID = process.env.PHONEPE_CLIENT_ID;
        const CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET;
        const CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || 1;

        // V1 Credentials (Fallback)
        const SALT_KEY = process.env.PHONEPE_SALT_KEY;
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;

        const IS_PROD = process.env.PHONEPE_ENV === 'production';

        if (!MERCHANT_ID || (!SALT_KEY && !CLIENT_ID)) {
            console.error("Missing PhonePe Credentials");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Server misconfiguration: Missing PhonePe Credentials. Ensure either SaltKey or ClientID is set." })
            };
        }

        // Base URL for callbacks
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

        let apiUrl;
        let apiHeaders = {
            'Content-Type': 'application/json',
        };

        // --- AUTHENTICATION FLOW SELECTION ---
        if (CLIENT_ID && CLIENT_SECRET) {
            // === V2 FLOW (No Salt, uses OAuth) ===
            console.log("Using PhonePe V2 (Client Credentials) Flow [Netlify]");

            const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, CLIENT_VERSION, IS_PROD);

            apiUrl = IS_PROD
                ? 'https://api.phonepe.com/apis/hermes/pg/v1/pay'
                : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

            apiHeaders['Authorization'] = `Bearer ${accessToken}`;

        } else {
            // === V1 FLOW (Standard Salt Checksum) ===
            console.log("Using PhonePe V1 (Salt Key) Flow [Netlify]");

            apiUrl = IS_PROD
                ? 'https://api.phonepe.com/apis/hermes/pg/v1/pay'
                : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

            const stringToSign = base64Payload + "/pg/v1/pay" + SALT_KEY;
            const checksum = crypto.createHash('sha256').update(stringToSign).digest('hex') + "###" + SALT_INDEX;

            apiHeaders['X-VERIFY'] = checksum;
        }

        const options = {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({ request: base64Payload })
        };

        console.log(`Initiating Payment to: ${apiUrl}`);

        const response = await fetch(apiUrl, options);
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
