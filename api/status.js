import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { transactionId } = req.query;

        if (!transactionId) {
            return res.status(400).json({ error: "Transaction ID is required" });
        }

        const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
        const SALT_KEY = process.env.PHONEPE_SALT_KEY;
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;

        // Prod URL: https://api.phonepe.com/apis/hermes/pg/v1/status/{merchantId}/{merchantTransactionId}
        const PHONEPE_HOST = process.env.PHONEPE_ENV === 'production'
            ? 'https://api.phonepe.com/apis/hermes'
            : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

        const stringToSign = `/pg/v1/status/${MERCHANT_ID}/${transactionId}` + SALT_KEY;
        const checksum = crypto.createHash('sha256').update(stringToSign).digest('hex') + "###" + SALT_INDEX;

        const url = `${PHONEPE_HOST}/pg/v1/status/${MERCHANT_ID}/${transactionId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': MERCHANT_ID
            }
        });

        const data = await response.json();

        if (data.success && data.code === 'PAYMENT_SUCCESS') {
            return res.status(200).json({ status: 'SUCCESS', data: data.data });
        } else if (data.code === 'PAYMENT_PENDING') {
            return res.status(200).json({ status: 'PENDING', data: data.data });
        } else {
            return res.status(200).json({ status: 'FAILED', message: data.message });
        }

    } catch (error) {
        console.error("Status Check Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
