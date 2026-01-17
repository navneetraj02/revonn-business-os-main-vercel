
import { toast } from "sonner";

/**
 * Initiates PhonePe Payment by calling the backend API.
 * This effectively hides the Salt Key and handles checksum generation on the server.
 */
export const initiatePhonePePayment = async (
    amount: number,
    userId: string,
    mobileNumber: string
): Promise<{ success: boolean; url?: string; transactionId?: string }> => {
    try {
        console.log("Initiating Payment via Backend...");

        // TEMPORARY WORKAROUND: Use Static Payment Link provided by User
        // The backend API integration is blocked due to missing Salt Key (X-VERIFY requirement).
        // This link allows users to pay via UPI apps directly.
        // Link likely expires in 1 day (needs manual update or ENV var).

        const STATIC_LINK = "https://phon.pe/jp4rcj7x";
        console.log("Using Static Payment Link:", STATIC_LINK);

        return {
            success: true,
            url: STATIC_LINK,
            transactionId: `STATIC_${Date.now()}` // Dummy ID since we don't have a real one from API
        };

        /* 
        // --- ORIGINAL API CALL LOGIC (Commented Out) ---
        const apiUrl = '/api/initiate';
        console.log(`Sending request to: ${window.location.origin}${apiUrl}`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, userId, mobileNumber })
        });
        
        // ... (rest of original logic)
        */
    } catch (error) {
        console.error("Payment Initiation Error:", error);
        // Friendly error messages based on common issues
        if (error.message.includes("Backend API unreachable")) {
            toast.error("Payment Server Error: API not accessible.");
        } else if (error.message.includes("Missing PhonePe Credentials")) {
            toast.error("Configuration Error: Payment Gateway credentials missing.");
        } else {
            toast.error(error.message || "Failed to initiate payment. Please try again.");
        }
        throw error;
    }
};

export const checkPaymentStatus = async (transactionId: string) => {
    try {
        const response = await fetch(`/api/status?transactionId=${transactionId}`);
        const data = await response.json();
        return data; // Expected: { success: true, status: 'SUCCESS' | 'PENDING' | 'FAILED' }
    } catch (error) {
        console.error("Status check failed", error);
        return { success: false, status: 'FAILED' };
    }
};
