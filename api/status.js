import crypto from 'crypto';

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
        const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
        const SALT_KEY = process.env.PHONEPE_SALT_KEY;
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;
        const IS_PROD = process.env.PHONEPE_ENV === 'production';

        if (!MERCHANT_ID || !SALT_KEY) {
            return res.status(500).json({ error: "Missing PhonePe Credentials" });
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
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
