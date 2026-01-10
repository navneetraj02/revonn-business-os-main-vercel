import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { amount, mobileNumber, userId } = req.body;

        const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
        const SALT_KEY = process.env.PHONEPE_SALT_KEY;
        const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;
        const HOST_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';

        // Prod URL: https://api.phonepe.com/apis/hermes/pg/v1/pay
        // Testing URL: https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay
        const PHONEPE_API_URL = process.env.PHONEPE_ENV === 'production'
            ? 'https://api.phonepe.com/apis/hermes/pg/v1/pay'
            : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

        const transactionId = "TXN_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

        const payload = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: transactionId,
            merchantUserId: userId,
            amount: amount * 100, // Amount in paise
            redirectUrl: `${HOST_URL}/payment-status`,
            redirectMode: "POST", // PhonePe will POST to this URL
            callbackUrl: `${HOST_URL}/api/webhook`,
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

        const response = await fetch(PHONEPE_API_URL, options);
        const data = await response.json();

        if (data.success) {
            return res.status(200).json({
                success: true,
                url: data.data.instrumentResponse.redirectInfo.url,
                transactionId: transactionId
            });
        } else {
            console.error("PhonePe Init Failed:", data);
            return res.status(400).json({ success: false, error: data.message || "Payment initiation failed" });
        }

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
