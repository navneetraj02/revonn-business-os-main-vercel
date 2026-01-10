import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // PhonePe sends headers: x-verify
        // Body is { response: base64 }
        const xVerify = req.headers['x-verify'];
        const { response } = req.body;

        const SALT_KEY = process.env.PHONEPE_SALT_KEY;

        // Validate Checksum (Optional but recommended)
        // const stringToSign = response + SALT_KEY;
        // const calculatedChecksum = crypto.createHash('sha256').update(stringToSign).digest('hex') + "###" + SALT_INDEX;
        // if (calculatedChecksum !== xVerify) { return res.status(400).send("Invalid Signature"); }

        const decoded = JSON.parse(Buffer.from(response, 'base64').toString('utf-8'));
        console.log("Webhook Received:", decoded);

        if (decoded.success && decoded.code === 'PAYMENT_SUCCESS') {
            // TODO: Update Database (Firestore) using Admin SDK
            // Since we are Serverless, we need Firebase Admin setup here to update user subscription securely.
            // For now, checking status from Frontend (polling) handles the user UI nicely.
            // This webhook is for robust background updates.
            console.log("Payment Successful for:", decoded.data.merchantTransactionId);
        }

        return res.status(200).json({ status: 'OK' });

    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(500).json({ error: "Webhook Failed" });
    }
}
