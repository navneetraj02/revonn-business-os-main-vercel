
import { toast } from "sonner";

// This is a client-side STUB for PhonePe integration.
// Real integration requires a Backend (Firebase Cloud Functions) because:
// 1. Salt Key must be hidden (Security)
// 2. PhonePe API might block CORS from browser
// 3. Checksum generation requires crypto libraries reliably

// Since Firebase Cloud Functions require the Blaze (Paid) plan, 
// we are using this Simulation Mode for now.
// passing 'true' to simulateSuccess will mimic a successful payment.

export const initiatePhonePePayment = async (
    amount: number,
    userId: string,
    mobileNumber: string
): Promise<{ success: boolean; url?: string; transactionId?: string }> => {
    try {
        const isLocal = window.location.hostname === 'localhost';
        const baseUrl = isLocal ? '' : ''; // In Vercel, /api is relative. In local, we might need proxy or just relative if using 'vercel dev'.

        // Check if we are in true dev mode without backend (mock)
        // Note: User can revert this by setting a flag if they want simulation back.
        // For now, we assume backend exists or will exist.

        console.log("Initiating Payment via Backend...");

        // Call Vercel Backend
        const response = await fetch(`${baseUrl}/api/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, userId, mobileNumber })
        });

        const data = await response.json();

        if (data.success) {
            return {
                success: true,
                url: data.url,
                transactionId: data.transactionId
            };
        } else {
            console.error("Backend Init Failed", data);
            throw new Error(data.error || "Payment initiation failed");
        }
    } catch (error) {
        console.warn("Backend unreachable? Falling back to Mock for Demo if needed, or throwing error.");
        console.error(error);
        // Be explicit about backend failure
        throw error;
    }
};

export const checkPaymentStatus = async (transactionId: string) => {
    try {
        const response = await fetch(`/api/status?transactionId=${transactionId}`);
        const data = await response.json();
        return data; // { status: 'SUCCESS' | 'PENDING' | 'FAILED' }
    } catch (error) {
        console.error("Status check failed", error);
        return { status: 'FAILED' };
    }
};
