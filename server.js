import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import initiate from './api/initiate.js';
import status from './api/status.js';
import webhook from './api/webhook.js';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env

// FORCE PROVIDED CREDENTIALS (Production - SU Key)
console.log("⚠️  Using User-Provided Production Credentials (SU...)");
process.env.PHONEPE_ENV = 'production';
process.env.PHONEPE_MERCHANT_ID = 'SU2512221950401083318722';
process.env.PHONEPE_SALT_KEY = '8711b0c3-fa11-423c-825d-526696307e07';
process.env.PHONEPE_SALT_INDEX = '1';

const app = express();
const PORT = 3000; // Standard Vercel port

// Middleware
app.use(cors());
app.use(express.json());

// Helper to adapt Vercel function signature (req, res) to Express
const adapt = (handler) => async (req, res) => {
    try {
        await handler(req, res);
    } catch (error) {
        console.error("API Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
};

// Routes
// Note: Vercel functions export 'default'
app.post('/api/initiate', adapt(initiate));
app.get('/api/status', adapt(status));
app.post('/api/webhook', adapt(webhook));

// Start Server
app.listen(PORT, () => {
    console.log(`
🚀 Local API Server running at http://localhost:${PORT}
   - POST /api/initiate
   - GET  /api/status
   - POST /api/webhook
`);
});
