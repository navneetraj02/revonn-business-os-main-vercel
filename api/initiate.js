import crypto from 'crypto';

export default async function handler(req, res) {
    // Enable CORS for localhost and production
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust this for production security if needed
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

        const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
        const SALT_KEY = process.env.PHONEPE_SALT_KEY;
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;

        // Determine Environment (Simulate if env vars missing, or use real based on config)
        const IS_PROD = process.env.PHONEPE_ENV === 'production';

        // If credentials are missing, we cannot proceed with real payment
        console.log("Debug Params:", { MERCHANT_ID, IS_PROD, ENV: process.env.PHONEPE_ENV });

        if (!MERCHANT_ID || !SALT_KEY) {
            console.error("Missing PhonePe Credentials");
            return res.status(500).json({
                error: "Server misconfiguration: Missing PhonePe Credentials. Please check .env.local"
            });
        }

        const HOST_URL = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:5173'; // Default to Vite local port

        const PHONEPE_API_URL = IS_PROD
            ? 'https://api.phonepe.com/apis/hermes/pg/v1/pay'
            : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

        // Unique Transaction ID
        const transactionId = `TXN_${userId.substring(0, 6)}_${Date.now()}`;

        const payload = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: transactionId,
            merchantUserId: userId,
            amount: amount * 100, // Amount in paise
            redirectUrl: `${HOST_URL}/payment-status`,
            redirectMode: "POST", // PhonePe POSTs to this URL after payment
            callbackUrl: `${HOST_URL}/api/webhook`, // Server-to-Server callback
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

        const response = await fetch(PHONEPE_API_URL, options);
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
                error: data.message || "Payment initiation failed at gateway",
                details: data
            });
        }

    } catch (error) {
        console.error("Server Internal Error:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}
