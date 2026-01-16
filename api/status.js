import crypto from 'crypto';

/**
 * Fetches the OAuth Access Token from PhonePe
 */
async function getAccessToken(clientId, clientSecret, clientVersion, isProd) {
    const tokenUrl = isProd
        ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

    // Robust trimming
    const cid = clientId ? clientId.trim() : '';
    const csec = clientSecret ? clientSecret.trim() : '';

    const auth = Buffer.from(`${cid}:${csec}`).toString('base64');

    // Timeout helper
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
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { transactionId } = req.query;

    if (!transactionId) {
        return res.status(400).json({ error: "Transaction ID is required" });
    }

    try {
        // Credentials
        const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID ? process.env.PHONEPE_MERCHANT_ID.trim() : '';

        // V2 Credentials
        const CLIENT_ID = process.env.PHONEPE_CLIENT_ID ? process.env.PHONEPE_CLIENT_ID.trim() : '';
        const CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET ? process.env.PHONEPE_CLIENT_SECRET.trim() : '';
        const CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || 1;

        // V1 Credentials
        const SALT_KEY = process.env.PHONEPE_SALT_KEY ? process.env.PHONEPE_SALT_KEY.trim() : '';
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;

        // Robust Environment Check
        const envRaw = process.env.PHONEPE_ENV || '';
        const IS_PROD = envRaw.trim().toLowerCase() === 'production';

        if (!MERCHANT_ID || (!SALT_KEY && !CLIENT_ID)) {
            return res.status(500).json({ error: "Missing PhonePe Credentials" });
        }

        const PHONEPE_STATUS_URL = IS_PROD
            ? `https://api.phonepe.com/apis/hermes/pg/v1/status/${MERCHANT_ID}/${transactionId}`
            : `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${MERCHANT_ID}/${transactionId}`;

        let headers = {
            'Content-Type': 'application/json',
            'X-MERCHANT-ID': MERCHANT_ID
        };

        if (CLIENT_ID && CLIENT_SECRET) {
            // === V2 FLOW ===
            const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, CLIENT_VERSION, IS_PROD);
            headers['Authorization'] = `Bearer ${accessToken}`;
        } else {
            // === V1 FLOW ===
            const stringToSign = `/pg/v1/status/${MERCHANT_ID}/${transactionId}` + SALT_KEY;
            const checksum = crypto.createHash('sha256').update(stringToSign).digest('hex') + "###" + SALT_INDEX;
            headers['X-VERIFY'] = checksum;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(PHONEPE_STATUS_URL, {
            method: 'GET',
            headers: headers,
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        const data = await response.json();

        if (data.success) {
            // Map PhonePe status to our status
            // COMPLETED, PENDING, FAILED
            return res.status(200).json({
                success: true,
                status: data.code === 'PAYMENT_SUCCESS' ? 'SUCCESS' :
                    data.code === 'PAYMENT_PENDING' ? 'PENDING' : 'FAILED',
                original_data: data
            });
        } else {
            return res.status(200).json({
                success: false,
                status: 'FAILED',
                message: data.message
            });
        }

    } catch (error) {
        console.error("Status Check Error:", error);
        return res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
}
