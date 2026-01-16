
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

        // Call Vercel Backend Function
        const apiUrl = '/api/initiate';
        console.log(`Sending request to: ${window.location.origin}${apiUrl}`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, userId, mobileNumber })
        });

        // Handle cases where response is not JSON (e.g. 404 HTML page or network error)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const rawText = await response.text();
            console.error("Backend returned non-JSON:", rawText);
            // Throw the actual HTML/Text content (truncated) so user can see it in Toast
            throw new Error(`Server Error (${response.status}): ${rawText.substring(0, 60)}...`);
        }

        const data = await response.json();

        if (response.ok && data.success) {
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
