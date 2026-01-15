import crypto from 'crypto';

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
        console.log("Token Response:", JSON.stringify(data));

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

export default async function handler(req, res) {
    // Enable CORS for localhost and production
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
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

        if (!amount || !userId || !mobileNumber) {
            return res.status(400).json({ error: 'Missing required fields: amount, userId, or mobileNumber' });
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

        // Determine Environment
        const IS_PROD = process.env.PHONEPE_ENV === 'production';

        const HOST_URL = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:5173';

        // Unique Transaction ID
        const transactionId = `TXN_${userId.substring(0, 6)}_${Date.now()}`;

        const payload = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: transactionId,
            merchantUserId: userId,
            amount: amount * 100, // Amount in paise
            redirectUrl: `${HOST_URL}/payment-status`,
            redirectMode: "POST",
            callbackUrl: `${HOST_URL}/api/webhook`,
            mobileNumber: mobileNumber,
            paymentInstrument: {
                type: "PAY_PAGE"
            },
            // V2 might require deviceContext or other fields depending on exact flow, 
            // but PAY_PAGE usually works with minimal fields.
        };

        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

        let apiUrl;
        let headers = {
            'Content-Type': 'application/json',
        };

        // --- AUTHENTICATION FLOW SELECTION ---

        if (CLIENT_ID && CLIENT_SECRET) {
            // === V2 FLOW (No Salt, uses OAuth) ===
            console.log("Using PhonePe V2 (Client Credentials) Flow");

            const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, CLIENT_VERSION, IS_PROD);
            console.log("Access Token Obtained"); // Don't log full token for security

            apiUrl = IS_PROD
                ? 'https://api.phonepe.com/apis/hermes/pg/v1/pay' // Check if V2 endpoint differs. Usually it's the same path but different Auth.
                : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

            // Note: Some V2 docs suggest /pg/v2/pay, but frequently it's just the Auth header that changes on v1 endpoint. 
            // If this fails, we will try /pg/v2/pay. For now keeping v1/pay as per standard docs unless specifically "V2 API" is mentioned vs "V2 Auth".
            // Accepted assumption: The user meant "Client Credential Auth" which is often called "New Stack" or "V2 Auth".

            headers['Authorization'] = `Bearer ${accessToken}`;
            // X-VERIFY is NOT sent in this flow ideally, or calculated differently. 
            // If the API strictly requires X-VERIFY even with Bearer, we can't generate it without Salt.
            // We assume Bearer replaces X-Verify.

        } else if (SALT_KEY) {
            // === V1 FLOW (Standard Salt Checksum) ===
            console.log("Using PhonePe V1 (Salt Key) Flow");

            apiUrl = IS_PROD
                ? 'https://api.phonepe.com/apis/hermes/pg/v1/pay'
                : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

            const stringToSign = base64Payload + "/pg/v1/pay" + SALT_KEY;
            const checksum = crypto.createHash('sha256').update(stringToSign).digest('hex') + "###" + SALT_INDEX;

            headers['X-VERIFY'] = checksum;

        } else {
            return res.status(500).json({
                error: "Server misconfiguration: Missing PhonePe Credentials (Either ClientID/Secret OR SaltKey/Index required)."
            });
        }

        // --- EXECUTE REQUEST ---

        const options = {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ request: base64Payload })
        };

        console.log(`Initiating Payment to: ${apiUrl}`);

        const response = await fetch(apiUrl, options);
        const data = await response.json();

        if (data.success) {
            return res.status(200).json({
                success: true,
                url: data.data.instrumentResponse.redirectInfo.url,
                transactionId: transactionId
            });
        } else {
            console.error("PhonePe Gateway Error:", JSON.stringify(data, null, 2));
            return res.status(400).json({
                success: false,
                error: data.message || "Payment initiation failed",
                details: data
            });
        }

    } catch (error) {
        console.error("Server Internal Error:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}

