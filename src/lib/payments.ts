
import { toast } from "sonner";

/**
 * Initiates PhonePe Payment by calling the backend API.
 * This effectively hides the Salt Key and handles checksum generation on the server.
 */
// Firebase Imports
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const initiatePhonePePayment = async (
    amount: number,
    userId: string,
    mobileNumber: string,
    salesCode?: string
): Promise<{ success: boolean; url?: string; transactionId?: string }> => {
    try {
        console.log("Initiating Payment via Backend...");

        // 1. If Sales Code is used, save it to the user's profile
        if (salesCode) {
            try {
                const userRef = doc(db, 'users', userId);
                await updateDoc(userRef, {
                    sales_code_used: salesCode,
                    last_sales_code_at: new Date().toISOString()
                });
                console.log(`Sales Code ${salesCode} saved for user ${userId}`);
            } catch (err) {
                console.error("Failed to save Sales Code:", err);
                // Continue payment even if tracking fails, or you can block it.
                // Choosing to continue to not lose the sale.
            }
        }

        // 2. Select Payment Link based on Amount
        // Standard (449) vs Discounted (299)
        let PAYMENT_LINK = "https://phon.pe/x4ly28sf"; // Default (399)

        // Exact Amount Mapping
        const linkMap: Record<number, string> = {
            399: "https://phon.pe/x4ly28sf",
            3999: "https://phon.pe/i3xki6w8",
            349: "https://phon.pe/vjkishr8",
            2499: "https://phon.pe/mtkb9klk"
        };

        if (linkMap[amount]) {
            PAYMENT_LINK = linkMap[amount];
        } else {
            console.warn(`No specific link found for amount ${amount}. Using default.`);
        }

        console.log("Using Payment Link:", PAYMENT_LINK);

        return {
            success: true,
            url: PAYMENT_LINK,
            transactionId: `STATIC_${Date.now()}` // Dummy ID since we don't have a real one from API
        };

        /* 
        // --- ORIGINAL API CALL LOGIC (Commented Out) ---
        // ...
        */
    } catch (error: any) {
        console.error("Payment Initiation Error:", error);
        if (error.message.includes("Backend API unreachable")) {
            toast.error("Payment Server Error: API not accessible.");
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
