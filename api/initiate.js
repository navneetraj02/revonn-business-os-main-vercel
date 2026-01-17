import crypto from 'crypto';

/**
 * Fetches the OAuth Access Token from PhonePe
 */
async function getAccessToken(clientId, clientSecret, clientVersion, isProd) {
    const tokenUrl = isProd
        ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

    console.log(`Fetching Access Token from: ${tokenUrl}`);

    // Robust trimming
    const cid = clientId ? clientId.trim() : '';
    const csec = clientSecret ? clientSecret.trim() : '';

    const auth = Buffer.from(`${cid}:${csec}`).toString('base64');

    // Timeout helper for Token Fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${auth}`
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: cid,
                client_secret: csec
            }),
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        const data = await response.json();

        if (data.access_token) {
            return data.access_token;
        } else {
            console.error("Token Fetch Failed:", JSON.stringify(data));
            throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        console.error("Token Fetch Error:", error);
        throw error;
    }
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Verify, X-Merchant-Id, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { amount, mobileNumber, userId } = req.body;

        if (!amount || !userId) {
            return res.status(400).json({ error: 'Missing required fields: amount or userId' });
        }

        // Credentials
        const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID ? process.env.PHONEPE_MERCHANT_ID.trim() : '';
        const CLIENT_ID = process.env.PHONEPE_CLIENT_ID ? process.env.PHONEPE_CLIENT_ID.trim() : '';
        const CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET ? process.env.PHONEPE_CLIENT_SECRET.trim() : '';
        const CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || 1;
        const SALT_KEY = process.env.PHONEPE_SALT_KEY ? process.env.PHONEPE_SALT_KEY.trim() : '';
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;

        // Robust Environment Check
        const envRaw = process.env.PHONEPE_ENV || '';
        const IS_PROD = envRaw.trim().toLowerCase() === 'production';

        if (!MERCHANT_ID) {
            throw new Error("Missing PHONEPE_MERCHANT_ID in Server Environment");
        }
        if (!CLIENT_ID && !SALT_KEY) {
            throw new Error("Missing Auth Credentials (CLIENT_ID or SALT_KEY) in Server Environment");
        }

        const HOST_URL = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : (process.env.URL || 'https://revonn.netlify.app'); // Fallback if migrated

        const transactionId = `TXN_${userId.substring(0, 6)}_${Date.now()}`;

        const safeAmount = Math.round(Number(amount) * 100); // Ensure Integer (Paise)
        const safeMobile = (mobileNumber || "9999999999").replace(/\D/g, '').slice(-10);

        const payload = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: transactionId,
            merchantUserId: userId,
            amount: safeAmount,
            redirectUrl: `${HOST_URL}/payment-status`,
            redirectMode: "POST",
            callbackUrl: `${HOST_URL}/api/webhook`,
            mobileNumber: safeMobile,
            paymentInstrument: {
                type: "PAY_PAGE"
            },
            deviceContext: {
                deviceOS: "WEB"
            }
        };

        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
        let apiUrl;
        let apiHeaders = { 'Content-Type': 'application/json' };

        if (CLIENT_ID && CLIENT_SECRET) {
            // === V2 FLOW (Client Credentials) ===
            console.log("Using PhonePe V2 (Client Credentials) Flow");

            const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, CLIENT_VERSION, IS_PROD);

            // V2 Endpoint is different: /checkout/v2/pay
            apiUrl = IS_PROD
                ? 'https://api.phonepe.com/apis/pg/checkout/v2/pay'
                : 'https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay';

            apiHeaders['Authorization'] = `Bearer ${accessToken}`;
            apiHeaders['X-MERCHANT-ID'] = MERCHANT_ID;

            // Note: Support said "V1 credentials (salt) not applicable". 
            // So we strictly DO NOT send X-VERIFY here.
            // If this fails, then V2 *does* require a checksum using a different mechanism,
            // but standard 'Authorization' + 'X-MERCHANT-ID' is the correct V2 structure.

        } else if (SALT_KEY) {
            // === V1 FLOW (Fallback) ===
            console.log("Using PhonePe V1 (Salt Key) Flow");

            apiUrl = IS_PROD
                ? 'https://api.phonepe.com/apis/hermes/pg/v1/pay'
                : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

            const stringToSign = base64Payload + "/pg/v1/pay" + SALT_KEY;
            const checksum = crypto.createHash('sha256').update(stringToSign).digest('hex') + "###" + SALT_INDEX;

            apiHeaders['X-VERIFY'] = checksum;
            apiHeaders['X-MERCHANT-ID'] = MERCHANT_ID;
        } else {
            throw new Error("No valid PhonePe authentication credentials provided.");
        }

        console.log(`Sending Payment Request to: ${apiUrl}`);

        // Payload Request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({ request: base64Payload }),
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        const textResponse = await response.text();
        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            console.error("PhonePe returned non-JSON:", textResponse);
            throw new Error(`PhonePe Gateway Error (${response.status} ${response.statusText}) from ${apiUrl}: ${textResponse.substring(0, 300)}...`);
        }

        if (data.success) {
            return res.status(200).json({
                success: true,
                url: data.data.instrumentResponse.redirectInfo.url,
                transactionId: transactionId
            });
        } else {
            console.error("Gateway Error:", data);
            return res.status(400).json({
                success: false,
                error: data.message || "Payment Failed",
                details: data
            });
        }

    } catch (error) {
        console.error("Initiate API Error:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: error.message,
            stack: error.stack?.split('\n')[0]
        });
    }
}
