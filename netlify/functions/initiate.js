import crypto from 'crypto';

/**
 * Fetches the OAuth Access Token from PhonePe
 */
async function getAccessToken(clientId, clientSecret, clientVersion, isProd) {
    const tokenUrl = isProd
        ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

    console.log(`Fetching Access Token from: ${tokenUrl}`);

    // Robust trimming to prevent "Invalid Client" due to whitespace
    const cid = clientId ? clientId.trim() : '';
    const csec = clientSecret ? clientSecret.trim() : '';

    const auth = Buffer.from(`${cid}:${csec}`).toString('base64');

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${auth}`
            },
            // PhonePe V2 sometimes benefits from having params in body as fallback
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: cid,
                client_secret: csec
            })
        });

        const data = await response.json();

        if (data.access_token) {
            return data.access_token;
        } else {
            console.error("Token Fetch Failed:", JSON.stringify(data));
            // Throw detailed error including the specific PhonePe error code
            throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        console.error("Token Fetch Error:", error);
        throw error;
    }
}

export const handler = async function (event, context) {
    // Basic CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Verify, X-Merchant-Id, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    try {
        if (event.httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers, body: '' };
        }

        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
        }

        let body = {};
        try {
            body = JSON.parse(event.body);
        } catch (e) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
        }

        const { amount, mobileNumber, userId } = body;

        if (!amount || !userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: amount or userId' })
            };
        }

        // --- DEBUG: LOG ENV VAR PRESENCE (Safety First) ---
        console.log("Checking Environment Variables...");
        const envCheck = {
            MERCHANT_ID: !!process.env.PHONEPE_MERCHANT_ID,
            CLIENT_ID: !!process.env.PHONEPE_CLIENT_ID,
            CLIENT_SECRET: !!process.env.PHONEPE_CLIENT_SECRET,
            SALT_KEY: !!process.env.PHONEPE_SALT_KEY,
            ENV: process.env.PHONEPE_ENV
        };
        console.log("Env Vars Present:", JSON.stringify(envCheck));

        // Credentials
        const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID ? process.env.PHONEPE_MERCHANT_ID.trim() : '';

        // V2 Credentials
        const CLIENT_ID = process.env.PHONEPE_CLIENT_ID ? process.env.PHONEPE_CLIENT_ID.trim() : '';
        const CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET ? process.env.PHONEPE_CLIENT_SECRET.trim() : '';
        const CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || 1;

        // V1 Credentials (Fallback)
        const SALT_KEY = process.env.PHONEPE_SALT_KEY ? process.env.PHONEPE_SALT_KEY.trim() : '';
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;

        // Robust Environment Check: "Production", "production ", "PRODUCTION" -> true
        const envRaw = process.env.PHONEPE_ENV || '';
        const IS_PROD = envRaw.trim().toLowerCase() === 'production';

        if (!MERCHANT_ID) {
            throw new Error("Missing PHONEPE_MERCHANT_ID in Server Environment");
        }
        if (!CLIENT_ID && !SALT_KEY) {
            throw new Error("Missing Auth Credentials (CLIENT_ID or SALT_KEY) in Server Environment");
        }

        // Base URL
        const HOST_URL = process.env.URL || 'https://revonn.netlify.app';
        const transactionId = `TXN_${userId.substring(0, 6)}_${Date.now()}`;

        const payload = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: transactionId,
            merchantUserId: userId,
            amount: amount * 100,
            redirectUrl: `${HOST_URL}/payment-status`,
            redirectMode: "POST",
            callbackUrl: `${HOST_URL}/.netlify/functions/webhook`,
            mobileNumber: mobileNumber || "9999999999",
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
        let apiUrl;
        let apiHeaders = { 'Content-Type': 'application/json' };

        // --- AUTH FLOW ---
        if (CLIENT_ID && CLIENT_SECRET) {
            console.log("Using V2 Client Flow");
            const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, CLIENT_VERSION, IS_PROD);

            apiUrl = IS_PROD
                ? 'https://api.phonepe.com/apis/hermes/pg/v1/pay'
                : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

            apiHeaders['Authorization'] = `Bearer ${accessToken}`;
        } else {
            console.log("Using V1 Salt Flow");
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

        console.log(`Sending Payment Request to: ${apiUrl}`);
        // Use timeout wrapper defined above (or inline it if scope is issue, but function scope is fine)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(apiUrl, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timeoutId));

        // Handle non-JSON responses from PhonePe (rare but possible)
        const textResponse = await response.text();
        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            console.error("PhonePe returned non-JSON:", textResponse);
            throw new Error(`PhonePe Gateway Error (${response.status} ${response.statusText}) from ${apiUrl}: ${textResponse.substring(0, 300)}...`);
        }

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
            console.error("Gateway Error:", data);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: data.message || "Payment Failed",
                    details: data
                })
            };
        }

    } catch (fatalError) {
        console.error("FATAL FUNCTION ERROR:", fatalError);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Internal Server Error",
                message: fatalError.message,
                stack: fatalError.stack?.split('\n')[0]
            })
        };
    }
};
