
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
        const baseUrl = '';

        console.log("Initiating Payment via Backend...");

        // Call Vercel Backend
        const response = await fetch(`${baseUrl}/api/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, userId, mobileNumber })
        });

        const isJson = response.headers.get('content-type')?.includes('application/json');
        if (!isJson) {
            throw new Error("Backend not responding with JSON (likely running locally without server).");
        }

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
        console.warn("Backend unavailable. Falling back to Simulation Mode for testing.");
        console.error(error);

        // REMOVED AUTOMATIC SIMULATION FALLBACK
        // The user wants REAL payments. If the backend is not reachable, we must fail.
        console.error("Backend Error or Unreachable:", error);

        throw new Error(
            "Backend API unreachable. " +
            "If running locally, please use 'vercel dev' instead of 'npm run dev'. " +
            "If deployed, ensure your API routes are working."
        );
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
